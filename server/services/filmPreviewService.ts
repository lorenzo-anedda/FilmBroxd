import { getAIClient } from "./geminiService.ts";

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

const previewCache = new Map<string, { data: FilmPreviewResult; ts: number }>();
const inFlightPreviews = new Map<string, Promise<FilmPreviewResult>>();
const PREVIEW_TTL_MS = 6 * 60 * 60 * 1000;

function cleanWikiUrl(src?: string): string | null {
  if (!src) return null;
  try {
    const u = new URL(src);
    u.searchParams.delete("utm_source");
    u.searchParams.delete("utm_campaign");
    u.searchParams.delete("utm_content");
    return u.toString();
  } catch {
    return src;
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
    if (yearsInMeta.has(yNum) || yearsInMeta.has(yNum - 1) || yearsInMeta.has(yNum + 1)) {
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

  const plotMatch = cleaned.match(/==\s*(?:Trama|Sinossi|Argomento)\s*==\s*([\s\S]*)/i);
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
      headers: { "User-Agent": "FilmBroxd/1.0 (cinema-recommender)" },
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return null;
    return (await r.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function resolveFilmPreview(
  title: string,
  itTitle: string,
  year: string,
  director: string
): Promise<FilmPreviewResult> {
  const searchQuery = [title, year, "film"].filter(Boolean).join(" ");
  const enUrl = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
    searchQuery
  )}&gsrlimit=5&prop=pageimages|langlinks|description|extracts&piprop=thumbnail&pithumbsize=500&pilicense=any&lllang=it&exintro=1&explaintext=1&exsentences=3&format=json`;

  const enData = await fetchWikiJson(enUrl);
  const enPages = Object.values(
    (enData?.query as { pages?: Record<string, WikiPage> } | undefined)?.pages || {}
  );

  let bestEn: WikiPage | null = null;
  let bestEnScore = 15;
  for (const p of enPages) {
    const sc = scoreWikiCandidate(p, title, itTitle, year, director);
    if (sc > bestEnScore) {
      bestEnScore = sc;
      bestEn = p;
    }
  }

  let posterUrl: string | null = null;
  if (bestEn?.thumbnail?.source) {
    const w = bestEn.thumbnail.width || 0;
    const h = bestEn.thumbnail.height || 0;
    if (!w || !h || h >= w * 0.78) {
      posterUrl = cleanWikiUrl(bestEn.thumbnail.source);
    }
  }

  let itPageTitle = bestEn?.langlinks?.find((l) => l.lang === "it")?.["*"] || "";

  if (!itPageTitle) {
    const itSearchQuery = [itTitle || title, year, "film"].filter(Boolean).join(" ");
    const itSearchUrl = `https://it.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
      itSearchQuery
    )}&gsrlimit=5&prop=pageimages|description|extracts&piprop=thumbnail&pithumbsize=500&pilicense=any&exintro=1&explaintext=1&exsentences=2&format=json`;
    const itSearchData = await fetchWikiJson(itSearchUrl);
    const itPages = Object.values(
      (itSearchData?.query as { pages?: Record<string, WikiPage> } | undefined)?.pages || {}
    );
    let bestIt: WikiPage | null = null;
    let bestItScore = 15;
    for (const p of itPages) {
      const sc = scoreWikiCandidate(p, title, itTitle, year, director);
      if (sc > bestItScore) {
        bestItScore = sc;
        bestIt = p;
      }
    }
    if (bestIt?.title) {
      itPageTitle = bestIt.title;
      if (!posterUrl && bestIt.thumbnail?.source) {
        posterUrl = cleanWikiUrl(bestIt.thumbnail.source);
      }
    }
  }

  let description = "";
  let hasItalianPlot = false;
  let wikiUrl: string | null = bestEn?.title
    ? `https://en.wikipedia.org/wiki/${encodeURIComponent(bestEn.title.replace(/ /g, "_"))}`
    : null;

  if (itPageTitle) {
    wikiUrl = `https://it.wikipedia.org/wiki/${encodeURIComponent(
      itPageTitle.replace(/ /g, "_")
    )}`;
    const itDetailUrl = `https://it.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(
      itPageTitle
    )}&prop=extracts|pageimages&explaintext=1&exchars=1600&pilicense=any&piprop=thumbnail&pithumbsize=500&format=json`;
    const itDetail = await fetchWikiJson(itDetailUrl);
    const page = Object.values(
      (itDetail?.query as { pages?: Record<string, WikiPage> } | undefined)?.pages || {}
    )[0];

    if (page?.extract) {
      const parsed = extractItalianSynopsis(page.extract);
      description = parsed.text;
      hasItalianPlot = parsed.hasPlot;
    }
    if (!posterUrl && page?.thumbnail?.source) {
      const w = page.thumbnail.width || 0;
      const h = page.thumbnail.height || 0;
      if (!w || !h || h >= w * 0.72) {
        posterUrl = cleanWikiUrl(page.thumbnail.source);
      }
    }
  }

  if (!hasItalianPlot) {
    const ai = getAIClient();
    if (ai) {
      try {
        const contextHint = bestEn?.extract
          ? `\nContesto: ${bestEn.extract.slice(0, 350)}`
          : "";
        const prompt = `Scrivi una breve sinossi senza spoiler in italiano (massimo 2 frasi, massimo 240 caratteri) per il film "${
          itTitle || title
        }"${year ? ` (${year})` : ""}${
          director ? ` diretto da ${director}` : ""
        }.${contextHint}\nRispondi solo con la descrizione, nessuna introduzione.`;
        const aiResp = await ai.models.generateContent({
          model: "gemini-3.1-flash-lite",
          contents: prompt,
        });
        const aiDesc = (aiResp.text ?? "").trim();
        if (aiDesc.length >= 25) {
          description = aiDesc;
        }
      } catch {
        // Keep Wikipedia intro / English extract fallback
      }
    }
  }

  if (!description && bestEn?.extract) {
    description = bestEn.extract.split("\n")[0].slice(0, 260).trim();
  }

  return { posterUrl, description, wikiUrl };
}

export async function getFilmPreview(params: {
  title: string;
  itTitle?: string;
  year?: string;
  director?: string;
}): Promise<FilmPreviewResult> {
  const title = params.title.trim();
  const itTitle = (params.itTitle || "").trim();
  const year = (params.year || "").trim();
  const director = (params.director || "").trim();

  const cacheKey = `${title.toLowerCase()}|${year}|${director.toLowerCase()}`;
  const cached = previewCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < PREVIEW_TTL_MS) {
    return cached.data;
  }

  let pending = inFlightPreviews.get(cacheKey);
  if (!pending) {
    pending = resolveFilmPreview(title, itTitle, year, director).finally(() => {
      inFlightPreviews.delete(cacheKey);
    });
    inFlightPreviews.set(cacheKey, pending);
  }

  const result = await pending;
  if (previewCache.size >= 500) {
    const firstKey = previewCache.keys().next().value;
    if (firstKey) previewCache.delete(firstKey);
  }
  previewCache.set(cacheKey, { data: result, ts: Date.now() });
  return result;
}
