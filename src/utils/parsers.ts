import { filmKey, itTitle, normTitle } from "./filmHelpers";
import type { DiaryEntry, FilmItem, SeenFilmItem } from "../types";

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
    const direct = JSON.parse(cleaned);
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
    return JSON.parse(balanced) as T;
  }

  if (opener === "[") {
    const objStr = extractBalanced(cleaned, "{");
    if (objStr) {
      const obj = JSON.parse(objStr);
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
          recovered.push(JSON.parse(nextObj));
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

  const entries: DiaryEntry[] = [];
  const seenCounts = new Map<string, number>();

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
    const letterboxdUrl = iUri >= 0 ? (r[iUri] || "").trim() || undefined : undefined;
    const k = `${t.toLowerCase()}|${y}`;
    const baseId = `${k}|${watchedDate}`;
    const occ = (seenCounts.get(baseId) || 0) + 1;
    seenCounts.set(baseId, occ);

    entries.push({
      id: occ > 1 ? `csv-${baseId}#${occ}` : `csv-${baseId}`,
      k,
      t,
      y,
      watchedDate,
      ...(loggedDate ? { loggedDate } : {}),
      r: Number.isNaN(rt) ? null : rt,
      ...(rw ? { rw: true } : {}),
      ...(tags && tags.length ? { tags } : {}),
      ...(letterboxdUrl ? { letterboxdUrl } : {}),
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
  const map = new Map<string, DiaryEntry>();
  const signatureOf = (e: DiaryEntry) => `${e.k}|${e.watchedDate}`;
  const sigToKey = new Map<string, string>();

  for (const item of existing) {
    map.set(item.id, { ...item });
    sigToKey.set(signatureOf(item), item.id);
  }

  for (const item of incoming) {
    const existingKey = map.has(item.id)
      ? item.id
      : sigToKey.get(signatureOf(item));
    if (!existingKey) {
      map.set(item.id, { ...item });
      sigToKey.set(signatureOf(item), item.id);
    } else {
      const prev = map.get(existingKey)!;
      const mergedTags = Array.from(
        new Set([...(prev.tags || []), ...(item.tags || [])])
      );
      map.set(existingKey, {
        ...prev,
        ...item,
        id: item.id.startsWith("letterboxd-") ? item.id : prev.id,
        r: item.r != null ? item.r : prev.r,
        rw: Boolean(prev.rw || item.rw) || undefined,
        tags: mergedTags.length ? mergedTags : undefined,
        letterboxdUrl: item.letterboxdUrl || prev.letterboxdUrl,
        posterUrl: item.posterUrl || prev.posterUrl,
      });
    }
  }

  return Array.from(map.values()).sort(
    (a, b) =>
      b.watchedDate.localeCompare(a.watchedDate) ||
      (b.loggedDate || "").localeCompare(a.loggedDate || "")
  );
}

export function diaryToSeenItems(entries: DiaryEntry[]): SeenFilmItem[] {
  const byFilm = new Map<string, { item: SeenFilmItem; count: number; latestDate: string }>();
  const ordered = [...entries].sort((a, b) =>
    a.watchedDate.localeCompare(b.watchedDate)
  );
  for (const entry of ordered) {
    const prev = byFilm.get(entry.k);
    if (!prev) {
      byFilm.set(entry.k, {
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
      byFilm.set(entry.k, {
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
  const keyOf = (x: { t: string; y?: string }) =>
    `${x.t.trim().toLowerCase()}|${(x.y || "").trim()}`;

  for (const item of existing) {
    map.set(keyOf(item), { ...item });
  }
  for (const item of incoming) {
    const k = keyOf(item);
    const prev = map.get(k);
    if (!prev) {
      map.set(k, { ...item });
    } else {
      map.set(k, {
        ...prev,
        r: item.r != null ? item.r : prev.r,
        rw: Boolean(prev.rw || item.rw) || undefined,
      });
    }
  }
  return Array.from(map.values());
}

export function buildFilmMatcher(
  films: ReadonlyArray<{ t: string; y?: string; it?: string }>
): (candidate: { t: string; y?: string; it?: string }) => boolean {
  const exactKeys = new Set<string>();
  const normYearMap = new Map<string, Set<string>>();

  const registerTitle = (title: string, year: string) => {
    const nt = normTitle(title);
    if (!nt) return;
    let set = normYearMap.get(nt);
    if (!set) {
      set = new Set<string>();
      normYearMap.set(nt, set);
    }
    set.add(year);
  };

  for (const f of films) {
    const y = (f.y || "").trim();
    exactKeys.add(filmKey({ t: f.t.trim(), y }));
    registerTitle(f.t, y);
    const it = itTitle(f as FilmItem);
    if (it) {
      exactKeys.add(filmKey({ t: it.trim(), y }));
      registerTitle(it, y);
    }
  }

  return (candidate) => {
    const y = (candidate.y || "").trim();
    if (exactKeys.has(filmKey({ t: candidate.t.trim(), y }))) return true;
    const nt = normTitle(candidate.t);
    const years = nt ? normYearMap.get(nt) : undefined;
    if (!years) return false;
    if (!y || years.has("") || years.has(y)) return true;
    const numY = Number(y);
    if (!Number.isFinite(numY)) return false;
    return (
      years.has(String(numY - 1)) ||
      years.has(String(numY + 1))
    );
  };
}

export function filterNewDiaryEntries(
  rssEntries: DiaryEntry[],
  existingSeen: SeenFilmItem[],
  existingDiary: DiaryEntry[]
): {
  unseenEntries: DiaryEntry[];
  skippedAlreadyLoaded: number;
} {
  const isSeenMatch = buildFilmMatcher(existingSeen);
  const existingDiaryIds = new Set(existingDiary.map((d) => d.id));
  const existingDiarySigs = new Set(
    existingDiary.map((d) => `${d.k}|${d.watchedDate}`)
  );

  const unseenEntries: DiaryEntry[] = [];
  let skippedAlreadyLoaded = 0;

  for (const entry of rssEntries) {
    const sig = `${entry.k}|${entry.watchedDate}`;
    const alreadyInDiary =
      existingDiaryIds.has(entry.id) || existingDiarySigs.has(sig);
    const alreadyInSeen = isSeenMatch(entry);

    if (alreadyInDiary || alreadyInSeen) {
      skippedAlreadyLoaded += 1;
    } else {
      unseenEntries.push(entry);
    }
  }

  return { unseenEntries, skippedAlreadyLoaded };
}

