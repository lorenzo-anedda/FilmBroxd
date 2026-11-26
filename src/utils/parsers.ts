import type { SeenFilmItem } from "../types";

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
  const out: SeenFilmItem[] = [];

  if (iN >= 0) {
    for (const r of rows.slice(1)) {
      const t = (r[iN] || "").trim();
      if (!t) continue;
      const rt = iR >= 0 ? parseFloat((r[iR] || "").replace(",", ".")) : NaN;
      out.push({
        t,
        y: iY >= 0 ? (r[iY] || "").trim() : "",
        r: Number.isNaN(rt) ? null : rt,
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
