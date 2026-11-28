import { generateWithRetries, getAIClient } from "./geminiService.ts";
import { geminiQuota } from "./geminiQuota.ts";

export interface FilmPreviewResult {
  posterUrl: string | null;
  description: string;
  wikiUrl: string | null;
}

interface WikiThumb {
  source?: string;
  width?: number;
  height?: number;
}

interface WikiPage {
  pageid?: number;
  title?: string;
  description?: string;
  extract?: string;
  thumbnail?: WikiThumb;
  langlinks?: Array<{ lang: string; "*": string }>;
}

interface CacheEntry {
  data: FilmPreviewResult;
  hasAiChecked: boolean;
  ts: number;
}

const previewCache = new Map<string, CacheEntry>();
const inFlightPreviews = new Map<string, Promise<FilmPreviewResult>>();
const PREVIEW_TTL_MS = 6 * 60 * 60 * 1000;

function validateHttpsUrl(src?: string, allowedHosts?: string[]): string | null {
  if (!src) return null;
  try {
    const u = new URL(src.trim());
    if (u.protocol !== "https:") return null;
    if (allowedHosts && allowedHosts.length > 0) {
      const host = u.hostname.toLowerCase();
      if (!allowedHosts.some((h) => host === h || host.endsWith(`.${h}`))) {
        return null;
      }
    }
    return u.toString();
  } catch {
    return null;
  }
}

function cleanWikiUrl(src?: string): string | null {
  const safe = validateHttpsUrl(src, ["wikimedia.org", "wikipedia.org"]);
  if (!safe) return null;
  try {
    const u = new URL(safe);
    u.searchParams.delete("utm_source");
    u.searchParams.delete("utm_campaign");
    u.searchParams.delete("utm_content");
    return u.toString();
  } catch {
    return null;
  }
}

function normSimple(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function scoreWikiCandidate(
  page: WikiPage,
  title: string,
  itTitle: string,
  year: string,
  director: string
): number {
  const pageTitle = page.title || "";
  const desc = (page.description || "").toLowerCase();
  const ext = (page.extract || "").toLowerCase();
  const titleLower = pageTitle.toLowerCase();

  if (
    desc.includes("disambiguation") ||
    desc.includes("disambigua") ||
    titleLower.includes("(disambiguation)") ||
    titleLower.includes("(disambigua)")
  ) {
    return -200;
  }

  let score = 0;
  const isFilmDesc =
    /\bfilm\b|\bmovie\b|\bpel[ií]cula\b|\bdocumentar/i.test(desc) ||
    /\bfilm\b/i.test(titleLower);
  if (isFilmDesc) score += 50;
  else if (
    /\bfictional\b|\bcharacter\b|\bsoundtrack\b|\balbum\b|\bsong\b|\bnovel\b|\blist of\b/i.test(
      desc
    )
  ) {
    score -= 40;
  }

  const nTarget = normSimple(title);
  const nIt = itTitle ? normSimple(itTitle) : "";
  const nPage = normSimple(pageTitle);
  if (nPage === nTarget || (nIt && nPage === nIt)) score += 40;
  else if (nPage.includes(nTarget) || (nIt && nPage.includes(nIt))) score += 20;
  else if (nTarget.includes(nPage) && nPage.length > 3) score += 10;

  if (year && /^\d{4}$/.test(year)) {
    const yNum = Number(year);
    const yearsInMeta = new Set<number>();
    for (const m of `${pageTitle} ${desc} ${ext.slice(0, 140)}`.matchAll(
      /\b(19\d{2}|20\d{2})\b/g
    )) {
      yearsInMeta.add(Number(m[1]));
    }
    if (
      yearsInMeta.has(yNum) ||
      yearsInMeta.has(yNum - 1) ||
      yearsInMeta.has(yNum + 1)
    ) {
      score += 45;
    } else if (yearsInMeta.size > 0) {
      score -= 55;
    }
  }

  if (director) {
    const lastWord = normSimple(director).split(" ").pop() || "";
    if (lastWord.length >= 3 && (desc.includes(lastWord) || ext.includes(lastWord))) {
      score += 35;
    }
  }

  if (page.thumbnail?.source) {
    const w = page.thumbnail.width || 0;
    const h = page.thumbnail.height || 0;
    score += h >= w ? 15 : 5;
  }

  return score;
}

function extractItalianSynopsis(rawExtract: string): { text: string; hasPlot: boolean } {
  const cleaned = rawExtract.replace(/\[\d+\]/g, "").trim();
  if (!cleaned) return { text: "", hasPlot: false };

  const plotMatch = cleaned.match(
    /==\s*(?:Trama|Sinossi|Argomento)\s*==\s*([\s\S]*)/i
  );
  const sliceFirstSentences = (block: string, maxChars: number): string => {
    const flat = block
      .split(/\n==/)[0]
      .replace(/\n+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!flat) return "";
    const sentences = flat.match(/[^.!?]+[.!?]+(?:\s|$)/g) || [flat];
    let out = "";
    for (const s of sentences) {
      const candidate = (out + s).trim();
      if (candidate.length <= maxChars || !out) {
        out = candidate;
        if (out.length >= 165) break;
      } else {
        break;
      }
    }
    if (out.length > maxChars) {
      out = out.slice(0, maxChars).replace(/\s+\S*$/, "") + "…";
    }
    return out.trim();
  };

  if (plotMatch?.[1]) {
    const plot = sliceFirstSentences(plotMatch[1], 270);
    if (plot.length >= 45) {
      return { text: plot, hasPlot: true };
    }
  }

  const intro = sliceFirstSentences(cleaned, 260);
  return { text: intro, hasPlot: intro.length >= 140 };
}

async function fetchWikiJson(url: string): Promise<Record<string, unknown> | null> {
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "Cineglyph/1.0 (cinema-recommender)" },
      signal: AbortSignal.timeout(4500),
    });
    if (!r.ok) return null;
    return (await r.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function pickBestWikiPage(
  data: Record<string, unknown> | null,
  title: string,
  itTitle: string,
  year: string,
  director: string
): WikiPage | null {
  const pages = Object.values(
    (data?.query as { pages?: Record<string, WikiPage> } | undefined)?.pages || {}
  );
  let best: WikiPage | null = null;
  let bestScore = 15;
  for (const p of pages) {
    const sc = scoreWikiCandidate(p, title, itTitle, year, director);
    if (sc > bestScore) {
      bestScore = sc;
      best = p;
    }
  }
  return best;
}

interface ImdbSuggestionItem {
  id?: string;
  l?: string;
  q?: string;
  qid?: string;
  y?: number;
  s?: string;
  i?: {
    imageUrl?: string;
    width?: number;
    height?: number;
  };
}

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

function slugifyLetterboxd(raw: string, stripApostrophe = true): string {
  let s = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/½/g, " 1 2 ")
    .replace(/&/g, " and ");
  if (stripApostrophe) {
    s = s.replace(/['’`]/g, "");
  }
  return s
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildLetterboxdSlugs(
  title: string,
  itTitle: string,
  year: string
): string[] {
  const seen = new Set<string>();
  const addSlug = (base: string) => {
    if (!base) return;
    if (year && /^\d{4}$/.test(year)) {
      seen.add(`${base}-${year}`);
    }
    seen.add(base);
  };

  addSlug(slugifyLetterboxd(title, true));
  const hyphenApos = slugifyLetterboxd(title, false);
  if (hyphenApos && hyphenApos !== slugifyLetterboxd(title, true)) {
    seen.add(hyphenApos);
  }
  if (itTitle && normSimple(itTitle) !== normSimple(title)) {
    addSlug(slugifyLetterboxd(itTitle, true));
  }

  return Array.from(seen).slice(0, 4);
}

function matchesDirectorName(
  targetDirector: string,
  candidateNames: string[]
): boolean {
  if (!targetDirector || candidateNames.length === 0) return true;
  const targetTokens = normSimple(targetDirector)
    .split(" ")
    .filter((w) => w.length >= 3);
  if (targetTokens.length === 0) return true;
  const targetLast = targetTokens[targetTokens.length - 1];

  return candidateNames.some((cand) => {
    const normCand = normSimple(cand);
    if (!normCand) return false;
    if (normCand === normSimple(targetDirector)) return true;
    const candTokens = normCand.split(" ");
    return candTokens.includes(targetLast);
  });
}

async function fetchLetterboxdFilmPoster(
  slug: string,
  targetYear: string,
  director: string
): Promise<string | null> {
  try {
    const r = await fetch(`https://letterboxd.com/film/${encodeURIComponent(slug)}/`, {
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(3800),
    });
    if (!r.ok) return null;
    const html = await r.text();
    if (!html || html.includes("Just a moment...")) return null;

    const ldMatch = html.match(
      /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i
    );
    if (!ldMatch?.[1]) return null;
    const cleanJson = ldMatch[1]
      .replace(/^\s*\/\*[\s\S]*?\*\//, "")
      .replace(/\/\*[\s\S]*?\*\/\s*$/, "")
      .trim();
    const ld = JSON.parse(cleanJson) as {
      "@type"?: string;
      image?: string;
      director?: Array<{ name?: string }> | { name?: string };
      releasedEvent?: Array<{ startDate?: string }>;
    };

    if (ld["@type"] && ld["@type"] !== "Movie") return null;
    const rawImageUrl = typeof ld.image === "string" ? ld.image : "";
    const imageUrl = validateHttpsUrl(rawImageUrl, ["ltrbxd.com"]);
    if (!imageUrl || !imageUrl.includes("/film-poster/")) return null;

    const titleTag = html.match(/<title>([^<]+)<\/title>/i)?.[1] || "";
    const yearMatch =
      titleTag.match(/\((\d{4})\)/)?.[1] ||
      ld.releasedEvent?.[0]?.startDate?.slice(0, 4) ||
      "";
    if (targetYear && /^\d{4}$/.test(targetYear) && yearMatch) {
      if (Math.abs(Number(yearMatch) - Number(targetYear)) > 1) {
        return null;
      }
    }

    const dirList = Array.isArray(ld.director)
      ? ld.director.map((d) => d.name || "").filter(Boolean)
      : ld.director?.name
        ? [ld.director.name]
        : [];
    if (director && dirList.length > 0 && !matchesDirectorName(director, dirList)) {
      return null;
    }

    return imageUrl;
  } catch {
    return null;
  }
}

async function fetchLetterboxdPoster(
  title: string,
  itTitle: string,
  year: string,
  director: string
): Promise<string | null> {
  const slugs = buildLetterboxdSlugs(title, itTitle, year);
  if (slugs.length === 0) return null;

  // Probe the top 2 slugs in parallel first (usually <slug>-<year> and <slug>)
  const primary = await Promise.all(
    slugs.slice(0, 2).map((s) => fetchLetterboxdFilmPoster(s, year, director))
  );
  const firstHit = primary.find(Boolean);
  if (firstHit) return firstHit;

  if (slugs.length > 2) {
    const secondary = await Promise.all(
      slugs.slice(2).map((s) => fetchLetterboxdFilmPoster(s, year, director))
    );
    return secondary.find(Boolean) || null;
  }

  return null;
}

function resizeImdbImage(rawUrl: string): string {
  if (/._V1_.*\.jpg$/i.test(rawUrl)) {
    return rawUrl.replace(/\._V1_.*\.jpg$/i, "._V1_UX380_.jpg");
  }
  return rawUrl;
}

async function queryImdbSuggestions(query: string): Promise<ImdbSuggestionItem[]> {
  const clean = query.trim();
  if (!clean) return [];
  const alnum = clean
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .match(/[a-z0-9]/)?.[0] || "x";
  try {
    const url = `https://v3.sg.media-imdb.com/suggestion/${alnum}/${encodeURIComponent(
      clean
    )}.json`;
    const r = await fetch(url, {
      headers: { "User-Agent": BROWSER_UA, Accept: "application/json" },
      signal: AbortSignal.timeout(3500),
    });
    if (!r.ok) return [];
    const data = (await r.json()) as { d?: ImdbSuggestionItem[] };
    return Array.isArray(data?.d) ? data.d : [];
  } catch {
    return [];
  }
}

function scoreImdbCandidate(
  item: ImdbSuggestionItem,
  title: string,
  itTitle: string,
  year: string
): number {
  const rawImg = item.i?.imageUrl;
  if (!rawImg) return -300;
  const w = item.i?.width || 0;
  const h = item.i?.height || 0;
  if (w > 0 && h > 0 && h < w * 0.8) return -300;

  const qid = (item.qid || "").toLowerCase();
  if (
    qid === "tvseries" ||
    qid === "tvminiseries" ||
    qid === "videogame" ||
    qid === "podcastseries" ||
    qid === "tvepisode" ||
    qid === "musicvideo"
  ) {
    return -200;
  }

  let score = 0;
  if (qid === "movie" || item.q === "feature") score += 45;
  else if (qid === "tvmovie" || qid === "short" || qid === "video") score += 25;
  else if (!item.id?.startsWith("tt")) return -300;

  const nCand = normSimple(item.l || "");
  const nTitle = normSimple(title);
  const nIt = itTitle ? normSimple(itTitle) : "";
  if (nCand && (nCand === nTitle || (nIt && nCand === nIt))) {
    score += 60;
  } else if (
    nCand &&
    ((nTitle && (nCand.includes(nTitle) || nTitle.includes(nCand))) ||
      (nIt && (nCand.includes(nIt) || nIt.includes(nCand))))
  ) {
    score += 28;
  } else {
    const titleWords = new Set(
      (nTitle || nIt).split(" ").filter((x) => x.length >= 3)
    );
    const candWords = nCand.split(" ").filter((x) => x.length >= 3);
    const overlap = candWords.filter((x) => titleWords.has(x)).length;
    if (overlap === 0 && titleWords.size > 0) score -= 35;
    else score += overlap * 12;
  }

  if (year && /^\d{4}$/.test(year) && typeof item.y === "number") {
    const diff = Math.abs(item.y - Number(year));
    if (diff === 0) score += 65;
    else if (diff === 1) score += 35;
    else score -= 85;
  }

  return score;
}

async function fetchImdbPoster(
  title: string,
  itTitle: string,
  year: string
): Promise<string | null> {
  const queries = [title];
  if (itTitle && normSimple(itTitle) !== normSimple(title)) {
    queries.push(itTitle);
  }
  const batches = await Promise.all(queries.map((q) => queryImdbSuggestions(q)));
  const seen = new Set<string>();
  const allItems: ImdbSuggestionItem[] = [];
  for (const list of batches) {
    for (const item of list) {
      if (item.id && !seen.has(item.id)) {
        seen.add(item.id);
        allItems.push(item);
      }
    }
  }

  let best: ImdbSuggestionItem | null = null;
  let bestScore = 50;
  for (const item of allItems) {
    const sc = scoreImdbCandidate(item, title, itTitle, year);
    if (sc > bestScore) {
      bestScore = sc;
      best = item;
    }
  }

  // Fallback query with year if first pass didn't match (useful for very common short titles)
  if (!best && year) {
    const withYear = await queryImdbSuggestions(`${title} ${year}`);
    for (const item of withYear) {
      const sc = scoreImdbCandidate(item, title, itTitle, year);
      if (sc > bestScore) {
        bestScore = sc;
        best = item;
      }
    }
  }

  return best?.i?.imageUrl
    ? validateHttpsUrl(resizeImdbImage(best.i.imageUrl), [
        "media-amazon.com",
        "media-imdb.com",
      ])
    : null;
}

async function resolveFilmPreview(
  title: string,
  itTitle: string,
  year: string,
  director: string,
  fast: boolean,
  clientId?: string
): Promise<{ data: FilmPreviewResult; hasAiChecked: boolean }> {
  const enSearchQuery = [title, year, "film"].filter(Boolean).join(" ");
  const enUrl = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
    enSearchQuery
  )}&gsrlimit=5&prop=pageimages|langlinks|description|extracts&piprop=thumbnail&pithumbsize=360&pilicense=any&lllang=it&exintro=1&explaintext=1&exsentences=3&format=json`;

  const itSearchQuery = [itTitle || title, year, "film"].filter(Boolean).join(" ");
  const itSearchUrl = `https://it.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
    itSearchQuery
  )}&gsrlimit=4&prop=pageimages|description|extracts&piprop=thumbnail&pithumbsize=360&pilicense=any&exintro=1&explaintext=1&exsentences=2&format=json`;

  // Resolve Letterboxd poster, IMDb poster, and Wikipedia data in parallel
  const [letterboxdPoster, imdbPoster, enData, itSearchData] = await Promise.all([
    fetchLetterboxdPoster(title, itTitle, year, director),
    fetchImdbPoster(title, itTitle, year),
    fetchWikiJson(enUrl),
    fetchWikiJson(itSearchUrl),
  ]);

  const bestEn = pickBestWikiPage(enData, title, itTitle, year, director);
  const bestIt = pickBestWikiPage(itSearchData, title, itTitle, year, director);

  let posterUrl: string | null = letterboxdPoster || imdbPoster || null;
  if (!posterUrl && bestEn?.thumbnail?.source) {
    const w = bestEn.thumbnail.width || 0;
    const h = bestEn.thumbnail.height || 0;
    if (!w || !h || h >= w * 0.78) {
      posterUrl = cleanWikiUrl(bestEn.thumbnail.source);
    }
  }
  if (!posterUrl && bestIt?.thumbnail?.source) {
    const w = bestIt.thumbnail.width || 0;
    const h = bestIt.thumbnail.height || 0;
    if (!w || !h || h >= w * 0.72) {
      posterUrl = cleanWikiUrl(bestIt.thumbnail.source);
    }
  }

  const itPageTitle =
    bestEn?.langlinks?.find((l) => l.lang === "it")?.["*"] ||
    bestIt?.title ||
    "";

  let description = bestIt?.extract
    ? extractItalianSynopsis(bestIt.extract).text
    : "";
  let hasItalianPlot = Boolean(description && description.length >= 140);
  let wikiUrl: string | null = bestEn?.title
    ? `https://en.wikipedia.org/wiki/${encodeURIComponent(
        bestEn.title.replace(/ /g, "_")
      )}`
    : null;

  if (itPageTitle) {
    wikiUrl = `https://it.wikipedia.org/wiki/${encodeURIComponent(
      itPageTitle.replace(/ /g, "_")
    )}`;

    // Fetch full Italian extract (includes == Trama ==) and Italian poster fallback if needed
    const needPlotOrPoster = !posterUrl || !fast || !hasItalianPlot;
    if (needPlotOrPoster) {
      const itDetailUrl = `https://it.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(
        itPageTitle
      )}&prop=extracts|pageimages&explaintext=1&exchars=1600&pilicense=any&piprop=thumbnail&pithumbsize=360&format=json`;
      const itDetail = await fetchWikiJson(itDetailUrl);
      const page = Object.values(
        (itDetail?.query as { pages?: Record<string, WikiPage> } | undefined)
          ?.pages || {}
      )[0];

      if (page?.extract) {
        const parsed = extractItalianSynopsis(page.extract);
        if (parsed.text) {
          description = parsed.text;
          hasItalianPlot = parsed.hasPlot;
        }
      }
      if (!posterUrl && page?.thumbnail?.source) {
        const w = page.thumbnail.width || 0;
        const h = page.thumbnail.height || 0;
        if (!w || !h || h >= w * 0.72) {
          posterUrl = cleanWikiUrl(page.thumbnail.source);
        }
      }
    }
  }

  let hasAiChecked = hasItalianPlot;
  if (!hasItalianPlot && !fast) {
    const ai = getAIClient();
    if (!ai) {
      hasAiChecked = true;
    } else {
      try {
        const contextHint = bestEn?.extract
          ? `\nContesto: ${bestEn.extract.slice(0, 350)}`
          : "";
        const prompt = `Scrivi una breve sinossi senza spoiler in italiano (massimo 2 frasi, massimo 240 caratteri) per il film "${
          itTitle || title
        }"${year ? ` (${year})` : ""}${
          director ? ` diretto da ${director}` : ""
        }.${contextHint}\nRispondi solo con la descrizione, nessuna introduzione.`;
        const aiDesc = (
          await generateWithRetries(ai, {
            prompt,
            jsonMode: "text",
            fast: true,
            clientId,
          })
        ).trim();
        hasAiChecked = true;
        if (aiDesc.length >= 25) {
          description = aiDesc;
        }
      } catch {
        // Keep Wikipedia intro fallback; do NOT mark hasAiChecked=true on transient/quota failure
        hasAiChecked = false;
      }
    }
  }

  if (!description && bestEn?.extract) {
    description = bestEn.extract.split("\n")[0].slice(0, 260).trim();
  }

  return {
    data: { posterUrl, description, wikiUrl },
    hasAiChecked,
  };
}

export async function getFilmPreview(params: {
  title: string;
  itTitle?: string;
  year?: string;
  director?: string;
  fast?: boolean;
  clientId?: string;
}): Promise<FilmPreviewResult> {
  const title = params.title.trim();
  const itTitle = (params.itTitle || "").trim();
  const year = (params.year || "").trim();
  const director = (params.director || "").trim();
  const fast = Boolean(params.fast);

  const cacheKey = `${title.toLowerCase()}|${year}|${director.toLowerCase()}`;
  const cached = previewCache.get(cacheKey);
  if (
    cached &&
    Date.now() - cached.ts < PREVIEW_TTL_MS &&
    (fast || cached.hasAiChecked)
  ) {
    geminiQuota.recordCacheHit();
    return cached.data;
  }

  const flightKey = `${cacheKey}|${fast ? "fast" : "full"}`;
  let pending = inFlightPreviews.get(flightKey);
  if (pending) {
    geminiQuota.recordDeduplicatedRequest();
    return pending;
  }

  pending = resolveFilmPreview(title, itTitle, year, director, fast, params.clientId)
    .then((resolved) => {
      if (previewCache.size >= 500) {
        const now = Date.now();
        for (const [k, entry] of previewCache.entries()) {
          if (now - entry.ts >= PREVIEW_TTL_MS) {
            previewCache.delete(k);
          }
        }
        if (previewCache.size >= 500) {
          const firstKey = previewCache.keys().next().value;
          if (firstKey) previewCache.delete(firstKey);
        }
      }
      const existing = previewCache.get(cacheKey);
      if (!existing || !existing.hasAiChecked || resolved.hasAiChecked) {
        previewCache.set(cacheKey, {
          data: resolved.data,
          hasAiChecked: resolved.hasAiChecked,
          ts: Date.now(),
        });
      }
      return resolved.data;
    })
    .finally(() => {
      inFlightPreviews.delete(flightKey);
    });
  inFlightPreviews.set(flightKey, pending);

  return pending;
}
