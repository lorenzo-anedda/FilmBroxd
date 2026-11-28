import {
  buildFilmIdentityMatcher,
  canonicalFilmIdentity,
  itTitle,
  normTitle,
  safeExternalUrl,
  type FilmMatchTarget,
} from "./filmHelpers";
import type { DiaryEntry, FilmItem, SeenFilmItem } from "../types";

const safeJsonParse = <T = unknown>(raw: string): T =>
  JSON.parse(raw, (key, value) =>
    key === "__proto__" || key === "constructor" || key === "prototype"
      ? undefined
      : value
  ) as T;

export function parseJsonSafely<T>(text: string, opener: "[" | "{"): T {
  const cleaned = String(text || "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  const extractBalanced = (src: string, openChar: "[" | "{"): string | null => {
    const closeChar = openChar === "[" ? "]" : "}";
    const start = src.indexOf(openChar);
    if (start < 0) return null;
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let i = start; i < src.length; i++) {
      const ch = src[i];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === "\\") esc = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') inStr = true;
      else if (ch === openChar) depth++;
      else if (ch === closeChar) {
        depth--;
        if (depth === 0) return src.slice(start, i + 1);
      }
    }
    return null;
  };

  try {
    const direct = safeJsonParse<unknown>(cleaned);
    if (opener === "[") {
      if (Array.isArray(direct)) return direct as T;
      if (direct && typeof direct === "object") {
        const arrVal = Object.values(direct).find((v) => Array.isArray(v));
        if (arrVal) return arrVal as T;
        if ("film" in direct) return [direct] as T;
      }
    } else {
      if (direct && !Array.isArray(direct) && typeof direct === "object") {
        return direct as T;
      }
      if (Array.isArray(direct) && direct[0] && typeof direct[0] === "object") {
        return direct[0] as T;
      }
    }
  } catch {
    // Fall back to balanced extraction below
  }

  const balanced = extractBalanced(cleaned, opener);
  if (balanced) {
    return safeJsonParse<T>(balanced);
  }

  if (opener === "[") {
    const objStr = extractBalanced(cleaned, "{");
    if (objStr) {
      const obj = safeJsonParse<unknown>(objStr);
      if (obj && typeof obj === "object") {
        const arrVal = Object.values(obj).find((v) => Array.isArray(v));
        if (arrVal) return arrVal as T;
        if ("film" in obj) return [obj] as T;
      }
    }
    const arrStart = cleaned.indexOf("[");
    if (arrStart >= 0) {
      const recovered: unknown[] = [];
      let idx = arrStart + 1;
      while (idx < cleaned.length) {
        const nextObjStart = cleaned.indexOf("{", idx);
        if (nextObjStart < 0) break;
        const nextObj = extractBalanced(cleaned.slice(nextObjStart), "{");
        if (!nextObj) break;
        try {
          recovered.push(safeJsonParse(nextObj));
        } catch {
          // skip malformed fragment
        }
        idx = nextObjStart + nextObj.length;
      }
      if (recovered.length > 0) return recovered as T;
      throw new Error("JSON incompleto nella risposta");
    }
  }

  throw new Error("Risposta AI senza JSON valido");
}

export function splitCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  const firstLine = text.split("\n")[0] || "";
  const delim =
    (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length
      ? ";"
      : ",";

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delim) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((x) => x.some((v) => v.trim()));
}

export function parseFilmImport(text: string): SeenFilmItem[] {
  const rows = splitCSV(text.replace(/^\uFEFF/, ""));
  if (!rows.length) return [];
  const header = rows[0].map((x) => x.trim().toLowerCase());
  const ix = (names: string[]) => header.findIndex((x) => names.includes(x));
  const iN = ix(["name", "title", "titolo", "nome"]);
  const iY = ix(["year", "anno"]);
  const iR = ix(["rating", "voto", "your rating"]);
  const iRw = ix(["rewatch"]);
  const out: SeenFilmItem[] = [];

  if (iN >= 0) {
    for (const r of rows.slice(1)) {
      const t = (r[iN] || "").trim();
      if (!t) continue;
      const rt = iR >= 0 ? parseFloat((r[iR] || "").replace(",", ".")) : NaN;
      const rwRaw = iRw >= 0 ? (r[iRw] || "").trim().toLowerCase() : "";
      const rw = rwRaw === "yes" || rwRaw === "true" || rwRaw === "1";
      out.push({
        t,
        y: iY >= 0 ? (r[iY] || "").trim() : "",
        r: Number.isNaN(rt) ? null : rt,
        ...(rw ? { rw: true } : {}),
      });
    }
  } else {
    for (const r of rows) {
      const line = r.join(",").trim();
      const m = line.match(/^(.*?)(?:[,;\t]\s*(\d+(?:[.,]\d+)?))?$/);
      if (!m || !m[1]) continue;
      const ym = m[1].match(/^(.*?)\s*\((\d{4})\)\s*$/);
      out.push({
        t: (ym ? ym[1] : m[1]).trim(),
        y: ym ? ym[2] : "",
        r: m[2] ? parseFloat(m[2].replace(",", ".")) : null,
      });
    }
  }
  return out;
}

export function isDiaryCSV(text: string): boolean {
  const rows = splitCSV(text.replace(/^\uFEFF/, "").slice(0, 2048));
  if (!rows.length) return false;
  const header = rows[0].map((x) => x.trim().toLowerCase());
  return header.includes("watched date");
}

function normalizeEventUri(rawUrl?: string | null): string | null {
  const safe = safeExternalUrl(rawUrl, ["letterboxd.com", "boxd.it"]);
  if (!safe) return null;
  try {
    const u = new URL(safe);
    return `${u.hostname.toLowerCase()}${u.pathname.replace(/\/+$/, "").toLowerCase()}`;
  } catch {
    return null;
  }
}

function uriHostFamily(rawUrl?: string | null): string | null {
  const safe = safeExternalUrl(rawUrl, ["letterboxd.com", "boxd.it"]);
  if (!safe) return null;
  try {
    const host = new URL(safe).hostname.toLowerCase();
    if (host === "boxd.it" || host.endsWith(".boxd.it")) return "boxd";
    if (host === "letterboxd.com" || host.endsWith(".letterboxd.com")) {
      return "letterboxd";
    }
    return host;
  } catch {
    return null;
  }
}

function isExternalFeedId(id: string): boolean {
  return Boolean(id) && !id.startsWith("csv-") && !id.startsWith("local-");
}

function isRewatchUrlPath(rawUrl?: string | null): boolean {
  const norm = normalizeEventUri(rawUrl);
  if (!norm) return false;
  return /\/film\/[^/]+\/\d+$/.test(norm);
}

function isSameDiaryFilmAndDate(a: DiaryEntry, b: DiaryEntry): boolean {
  if (a.watchedDate !== b.watchedDate) return false;
  if (a.k === b.k) return true;
  const ya = (a.y || "").trim();
  const yb = (b.y || "").trim();
  if (ya !== yb) return false;
  const na = normTitle(a.t);
  const nb = normTitle(b.t);
  return Boolean(na && nb && na === nb);
}

function diaryEventsConflict(a: DiaryEntry, b: DiaryEntry): boolean {
  // Two distinct external RSS/feed IDs are separate viewing events
  if (isExternalFeedId(a.id) && isExternalFeedId(b.id) && a.id !== b.id) {
    return true;
  }

  // Two distinct Letterboxd URIs on the same host family are separate viewing events
  const famA = uriHostFamily(a.letterboxdUrl);
  const famB = uriHostFamily(b.letterboxdUrl);
  if (famA && famB && famA === famB) {
    const uriA = normalizeEventUri(a.letterboxdUrl);
    const uriB = normalizeEventUri(b.letterboxdUrl);
    if (uriA && uriB && uriA !== uriB) {
      return true;
    }
  }

  // Two CSV entries on the same day with distinct explicit event suffixes (e.g. URI or distinct rw/loggedDate)
  if (
    a.id.startsWith("csv-") &&
    b.id.startsWith("csv-") &&
    a.id !== b.id &&
    (a.id.includes("|uri:") ||
      b.id.includes("|uri:") ||
      a.id.includes("|attr:") ||
      b.id.includes("|attr:"))
  ) {
    return true;
  }

  return false;
}

export function parseDiaryCSV(text: string): DiaryEntry[] {
  const rows = splitCSV(text.replace(/^\uFEFF/, ""));
  if (rows.length < 2) return [];
  const header = rows[0].map((x) => x.trim().toLowerCase());
  const ix = (names: string[]) => header.findIndex((x) => names.includes(x));
  const iN = ix(["name", "title", "titolo", "nome"]);
  const iY = ix(["year", "anno"]);
  const iR = ix(["rating", "voto", "your rating"]);
  const iRw = ix(["rewatch"]);
  const iTags = ix(["tags"]);
  const iWatched = ix(["watched date"]);
  const iLogged = ix(["date"]);
  const iUri = ix(["letterboxd uri", "uri"]);
  if (iN < 0 || (iWatched < 0 && iLogged < 0)) return [];

  interface RawParsedCsvRow {
    k: string;
    t: string;
    y: string;
    watchedDate: string;
    loggedDate?: string;
    r: number | null;
    rw: boolean;
    tags?: string[];
    letterboxdUrl?: string;
    normUri: string | null;
  }

  const parsedRows: RawParsedCsvRow[] = [];
  const sameDayRowsMap = new Map<string, RawParsedCsvRow[]>();

  for (const r of rows.slice(1)) {
    const t = (r[iN] || "").trim();
    if (!t) continue;
    const y = iY >= 0 ? (r[iY] || "").trim() : "";
    const watchedRaw = iWatched >= 0 ? (r[iWatched] || "").trim() : "";
    const loggedRaw = iLogged >= 0 ? (r[iLogged] || "").trim() : "";
    const watchedDate = /^\d{4}-\d{2}-\d{2}/.test(watchedRaw)
      ? watchedRaw.slice(0, 10)
      : /^\d{4}-\d{2}-\d{2}/.test(loggedRaw)
        ? loggedRaw.slice(0, 10)
        : "";
    if (!watchedDate) continue;

    const loggedDate = /^\d{4}-\d{2}-\d{2}/.test(loggedRaw)
      ? loggedRaw.slice(0, 10)
      : undefined;
    const rt = iR >= 0 ? parseFloat((r[iR] || "").replace(",", ".")) : NaN;
    const rwRaw = iRw >= 0 ? (r[iRw] || "").trim().toLowerCase() : "";
    const rw = rwRaw === "yes" || rwRaw === "true" || rwRaw === "1";
    const tagsRaw = iTags >= 0 ? (r[iTags] || "").trim() : "";
    const tags = tagsRaw
      ? tagsRaw
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean)
      : undefined;
    const rawUri = iUri >= 0 ? (r[iUri] || "").trim() : "";
    const letterboxdUrl = rawUri
      ? safeExternalUrl(rawUri, ["letterboxd.com", "boxd.it"]) || undefined
      : undefined;
    const k = `${t.toLowerCase()}|${y}`;
    const rowObj: RawParsedCsvRow = {
      k,
      t,
      y,
      watchedDate,
      loggedDate,
      r: Number.isNaN(rt) ? null : rt,
      rw,
      tags,
      letterboxdUrl,
      normUri: normalizeEventUri(letterboxdUrl),
    };
    parsedRows.push(rowObj);
    const dayKey = `${k}|${watchedDate}`;
    const bucket = sameDayRowsMap.get(dayKey) || [];
    bucket.push(rowObj);
    sameDayRowsMap.set(dayKey, bucket);
  }

  const entries: DiaryEntry[] = [];
  const seenIds = new Set<string>();

  for (const row of parsedRows) {
    const baseId = `${row.k}|${row.watchedDate}`;
    let id = `csv-${baseId}`;
    if (row.normUri) {
      id = `csv-${baseId}|uri:${row.normUri}`;
    } else {
      const siblings = sameDayRowsMap.get(baseId) || [];
      if (siblings.length > 1) {
        const hasDistinctAttr = siblings.some(
          (s) =>
            s.rw !== row.rw ||
            (s.loggedDate || "") !== (row.loggedDate || "") ||
            (s.tags || []).join(",") !== (row.tags || []).join(",")
        );
        if (hasDistinctAttr) {
          id = `csv-${baseId}|attr:${row.rw ? "1" : "0"}|${row.loggedDate || ""}|${(
            row.tags || []
          ).join(",")}`;
        }
      }
    }

    // Never turn completely identical rows without URI/distinguishing info into duplicate viewings
    if (seenIds.has(id)) continue;
    seenIds.add(id);

    entries.push({
      id,
      k: row.k,
      t: row.t,
      y: row.y,
      watchedDate: row.watchedDate,
      ...(row.loggedDate ? { loggedDate: row.loggedDate } : {}),
      r: row.r,
      ...(row.rw ? { rw: true } : {}),
      ...(row.tags && row.tags.length ? { tags: row.tags } : {}),
      ...(row.letterboxdUrl ? { letterboxdUrl: row.letterboxdUrl } : {}),
    });
  }

  return entries.sort(
    (a, b) =>
      b.watchedDate.localeCompare(a.watchedDate) ||
      (b.loggedDate || "").localeCompare(a.loggedDate || "")
  );
}

export function mergeDiaryEntries(
  existing: DiaryEntry[],
  incoming: DiaryEntry[]
): DiaryEntry[] {
  const result: DiaryEntry[] = existing.map((e) => ({ ...e }));

  const findMatchIndex = (item: DiaryEntry): number => {
    const byId = result.findIndex((e) => e.id === item.id);
    if (byId >= 0) return byId;

    const itemUri = normalizeEventUri(item.letterboxdUrl);
    if (itemUri) {
      const byUri = result.findIndex(
        (e) =>
          isSameDiaryFilmAndDate(e, item) &&
          normalizeEventUri(e.letterboxdUrl) === itemUri
      );
      if (byUri >= 0) return byUri;
    }

    return result.findIndex(
      (e) => isSameDiaryFilmAndDate(e, item) && !diaryEventsConflict(e, item)
    );
  };

  for (const item of incoming) {
    const idx = findMatchIndex(item);
    if (idx < 0) {
      result.push({ ...item });
    } else {
      const prev = result[idx];
      const mergedTags = Array.from(
        new Set([...(prev.tags || []), ...(item.tags || [])])
      );
      result[idx] = {
        ...prev,
        ...item,
        id: isExternalFeedId(item.id)
          ? item.id
          : isExternalFeedId(prev.id)
            ? prev.id
            : prev.id,
        r: item.r != null ? item.r : prev.r,
        rw: Boolean(prev.rw || item.rw) || undefined,
        tags: mergedTags.length ? mergedTags : undefined,
        letterboxdUrl: item.letterboxdUrl || prev.letterboxdUrl,
        posterUrl: item.posterUrl || prev.posterUrl,
      };
    }
  }

  return result.sort(
    (a, b) =>
      b.watchedDate.localeCompare(a.watchedDate) ||
      (b.loggedDate || "").localeCompare(a.loggedDate || "")
  );
}

export function diaryToSeenItems(entries: DiaryEntry[]): SeenFilmItem[] {
  const byFilm = new Map<
    string,
    { item: SeenFilmItem; count: number; latestDate: string }
  >();
  const ordered = [...entries].sort((a, b) =>
    a.watchedDate.localeCompare(b.watchedDate)
  );
  for (const entry of ordered) {
    const canon = canonicalFilmIdentity(entry);
    const prev = byFilm.get(canon);
    if (!prev) {
      byFilm.set(canon, {
        item: {
          t: entry.t,
          y: entry.y,
          r: entry.r ?? null,
          ...(entry.rw ? { rw: true } : {}),
        },
        count: 1,
        latestDate: entry.watchedDate,
      });
    } else {
      byFilm.set(canon, {
        item: {
          t: prev.item.t,
          y: prev.item.y,
          r: entry.r != null ? entry.r : prev.item.r,
          ...(prev.item.rw || entry.rw ? { rw: true } : {}),
        },
        count: prev.count + 1,
        latestDate: entry.watchedDate,
      });
    }
  }
  return Array.from(byFilm.values()).map(({ item, count }) =>
    count > 1 ? { ...item, rw: true } : item
  );
}

export function mergeSeenImports(
  existing: SeenFilmItem[],
  incoming: SeenFilmItem[]
): SeenFilmItem[] {
  const map = new Map<string, SeenFilmItem>();
  const altIndex = new Map<string, string>();

  const registerKeys = (item: SeenFilmItem, canonKey: string) => {
    const y = (item.y || "").trim();
    const alt = itTitle(item);
    if (alt) {
      const nAlt = normTitle(alt);
      if (nAlt) altIndex.set(`${nAlt}|${y}`, canonKey);
    }
    const nt = normTitle(item.t);
    if (nt) altIndex.set(`${nt}|${y}`, canonKey);
  };

  for (const item of existing) {
    const canon = canonicalFilmIdentity(item);
    map.set(canon, { ...item });
    registerKeys(item, canon);
  }

  for (const item of incoming) {
    const y = (item.y || "").trim();
    const directCanon = canonicalFilmIdentity(item);
    const alt = itTitle(item);
    const nAlt = alt ? normTitle(alt) : "";
    const matchedKey =
      (map.has(directCanon) ? directCanon : undefined) ||
      altIndex.get(directCanon) ||
      (nAlt ? altIndex.get(`${nAlt}|${y}`) : undefined);

    if (!matchedKey) {
      map.set(directCanon, { ...item });
      registerKeys(item, directCanon);
    } else {
      const prev = map.get(matchedKey)!;
      map.set(matchedKey, {
        ...prev,
        r: item.r != null ? item.r : prev.r,
        rw: Boolean(prev.rw || item.rw) || undefined,
      });
    }
  }
  return Array.from(map.values());
}

export function buildFilmMatcher(
  films: ReadonlyArray<FilmMatchTarget>
): (candidate: FilmMatchTarget) => boolean {
  const matcher = buildFilmIdentityMatcher(films);
  return (candidate) => matcher.match(candidate) === "exact";
}

export function filterNewDiaryEntries(
  rssEntries: DiaryEntry[],
  existingSeen: SeenFilmItem[],
  existingDiary: DiaryEntry[]
): {
  unseenEntries: DiaryEntry[];
  skippedAlreadyLoaded: number;
} {
  const seenMatcher = buildFilmIdentityMatcher(existingSeen);
  const diaryFilmMatcher = buildFilmIdentityMatcher(existingDiary);
  const existingDiaryIds = new Set(existingDiary.map((d) => d.id));
  const existingDiaryUris = new Set(
    existingDiary
      .map((d) => normalizeEventUri(d.letterboxdUrl))
      .filter((u): u is string => Boolean(u))
  );

  const unseenEntries: DiaryEntry[] = [];
  let skippedAlreadyLoaded = 0;

  for (const entry of rssEntries) {
    const entryUri = normalizeEventUri(entry.letterboxdUrl);
    const alreadyInDiary =
      existingDiaryIds.has(entry.id) ||
      Boolean(entryUri && existingDiaryUris.has(entryUri)) ||
      existingDiary.some(
        (d) => isSameDiaryFilmAndDate(d, entry) && !diaryEventsConflict(d, entry)
      );

    if (alreadyInDiary) {
      skippedAlreadyLoaded += 1;
      continue;
    }

    const isIntentionalRewatch =
      Boolean(entry.rw) ||
      isRewatchUrlPath(entry.letterboxdUrl) ||
      diaryFilmMatcher.match(entry) === "exact";

    if (isIntentionalRewatch) {
      unseenEntries.push(entry);
      continue;
    }

    const alreadyInSeen = seenMatcher.match(entry) === "exact";
    if (alreadyInSeen) {
      skippedAlreadyLoaded += 1;
    } else {
      unseenEntries.push(entry);
    }
  }

  return { unseenEntries, skippedAlreadyLoaded };
}

