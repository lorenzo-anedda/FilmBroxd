import { Router } from "express";
import type { DiaryEntry } from "../../src/types.ts";

export const letterboxdRouter = Router();

const USERNAME_RE = /^[a-zA-Z0-9_-]{1,40}$/;
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

function decodeXmlEntities(raw: string): string {
  return raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, hex) =>
      String.fromCodePoint(parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_m, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&amp;/g, "&")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function extractTag(block: string, tagName: string): string {
  const escaped = tagName.replace(/:/g, "\\:");
  const re = new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, "i");
  const match = block.match(re);
  return match?.[1] ? decodeXmlEntities(match[1]) : "";
}

function toIsoDate(pubDate: string): string | undefined {
  if (!pubDate) return undefined;
  const parsed = new Date(pubDate);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString().slice(0, 10);
}

function normKey(title: string, year: string): string {
  return `${title.trim().toLowerCase()}|${year.trim()}`;
}

const MAX_RSS_BYTES = 2 * 1024 * 1024;
const MAX_RSS_ITEMS = 200;

function sanitizeRssUrl(raw: string, allowedHosts: string[]): string | undefined {
  if (!raw) return undefined;
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "https:") return undefined;
    const host = u.hostname.toLowerCase();
    if (!allowedHosts.some((h) => host === h || host.endsWith(`.${h}`))) {
      return undefined;
    }
    return u.toString();
  } catch {
    return undefined;
  }
}

export function parseLetterboxdRss(xml: string): DiaryEntry[] {
  const items = xml.match(/<item>[\s\S]*?<\/item>/gi) || [];
  const entries: DiaryEntry[] = [];
  const seenIds = new Set<string>();

  for (const item of items.slice(0, MAX_RSS_ITEMS)) {
    const guid = extractTag(item, "guid").slice(0, 200);
    const watchedDateRaw = extractTag(item, "letterboxd:watchedDate");
    const watchedDate = /^\d{4}-\d{2}-\d{2}$/.test(watchedDateRaw)
      ? watchedDateRaw
      : "";
    const filmTitle = extractTag(item, "letterboxd:filmTitle").slice(0, 250);
    if (!watchedDate || !filmTitle) {
      // Skip non-diary feed entries (e.g. lists)
      continue;
    }

    const rawYear = extractTag(item, "letterboxd:filmYear");
    const filmYear = /^\d{4}$/.test(rawYear) ? rawYear : "";
    const ratingStr = extractTag(item, "letterboxd:memberRating");
    const rewatchStr = extractTag(item, "letterboxd:rewatch").toLowerCase();
    const link = sanitizeRssUrl(extractTag(item, "link"), [
      "letterboxd.com",
      "boxd.it",
    ]);
    const pubDate = extractTag(item, "pubDate");
    const descRaw =
      item.match(/<description[^>]*>([\s\S]*?)<\/description>/i)?.[1] || "";
    const posterMatch = descRaw.match(
      /src=["'](https:\/\/a\.ltrbxd\.com\/resized\/film-poster\/[^"']+)["']/i
    );
    const posterUrl = posterMatch?.[1]
      ? sanitizeRssUrl(posterMatch[1], ["a.ltrbxd.com", "ltrbxd.com"])
      : undefined;

    const k = normKey(filmTitle, filmYear);
    const id = guid || `${k}|${watchedDate}`;
    if (seenIds.has(id)) continue;
    seenIds.add(id);

    const parsedRating = ratingStr ? parseFloat(ratingStr) : NaN;
    const rw = rewatchStr === "yes" || rewatchStr === "true";

    entries.push({
      id,
      k,
      t: filmTitle,
      y: filmYear,
      watchedDate,
      loggedDate: toIsoDate(pubDate),
      r: Number.isFinite(parsedRating) ? parsedRating : null,
      ...(rw ? { rw: true } : {}),
      ...(link ? { letterboxdUrl: link } : {}),
      ...(posterUrl ? { posterUrl } : {}),
    });
  }

  return entries.sort(
    (a, b) =>
      b.watchedDate.localeCompare(a.watchedDate) ||
      (b.loggedDate || "").localeCompare(a.loggedDate || "")
  );
}

letterboxdRouter.get("/letterboxd/diary", async (req, res) => {
  const user = String(req.query.user || "")
    .trim()
    .replace(/^@/, "")
    .toLowerCase();

  if (!USERNAME_RE.test(user)) {
    res.status(400).json({
      error:
        "Username Letterboxd non valido. Usa solo lettere, numeri, trattini o underscore.",
    });
    return;
  }

  const rssUrl = `https://letterboxd.com/${encodeURIComponent(user)}/rss/`;
  try {
    const response = await fetch(rssUrl, {
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "application/rss+xml, application/xml, text/xml;q=0.9",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (response.status === 404) {
      res.status(404).json({
        error: `Utente Letterboxd "${user}" non trovato o profilo non pubblico.`,
      });
      return;
    }

    if (!response.ok) {
      res.status(502).json({
        error: `Letterboxd ha risposto con stato ${response.status}. Riprova tra poco.`,
      });
      return;
    }

    const xml = (await response.text()).slice(0, MAX_RSS_BYTES);
    if (!xml.includes("<rss") && !xml.includes("<channel")) {
      res.status(502).json({
        error: "Risposta non valida dal feed RSS di Letterboxd.",
      });
      return;
    }

    const entries = parseLetterboxdRss(xml);
    res.json({
      user,
      entries,
      fetchedAt: Date.now(),
    });
  } catch {
    res.status(504).json({
      error: "Impossibile raggiungere il feed RSS di Letterboxd in questo momento.",
    });
  }
});
