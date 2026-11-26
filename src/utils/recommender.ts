import { COUNTRY_FILTERS, GENRE_FILTERS, TITLE_RULES } from "../constants/filters";
import {
  canonicalLabel,
  filmKey,
  itTitle,
  normTitle,
  type FilterConfig,
} from "./filmHelpers";
import type {
  FilmItem,
  FilmMeta,
  LibraryState,
  OutcomeKey,
  RawRecommendation,
  RiskMode,
  SeenFilmItem,
} from "../types";

const MOOD_GENRE_KEYWORDS: Record<string, string[]> = {
  Leggero: ["comm", "anim", "famil"],
  Divertente: ["comm"],
  Rilassante: ["comm", "anim", "romant", "famil"],
  Commovente: ["dramm", "romant"],
  Intenso: ["dramm", "thrill", "guerra", "crime"],
  "Da brividi": ["horror", "thrill", "giallo", "mistero"],
  Cervellotico: ["fantascienza", "thrill", "mistero", "fantasy"],
  Adrenalina: ["azione", "avvent", "thrill", "crime"],
};

function computeDecadeAffinity(allSeen: SeenFilmItem[]): Record<number, number> {
  const rated = allSeen.filter((x) => x.r != null && +x.y);
  if (!rated.length) return {};
  const maxR = Math.max(5, ...rated.map((x) => x.r || 0));
  const unit = maxR <= 5 ? 1 : 2;
  const buckets: Record<number, number[]> = {};
  rated.forEach((x) => {
    const d = Math.floor(+x.y / 10) * 10;
    (buckets[d] = buckets[d] || []).push((x.r || 0) / unit);
  });
  const out: Record<number, number> = {};
  for (const d in buckets) {
    const arr = buckets[d];
    out[+d] =
      (arr.reduce((a, b) => a + b, 0) / arr.length - 3.5) *
      (Math.min(arr.length, 10) / 10);
  }
  return out;
}

function computeGenrePenalty(lib: LibraryState): Record<string, number> {
  const gp: Record<string, number> = {};
  const allKw = Object.values(MOOD_GENRE_KEYWORDS).flat();
  Object.values(lib.marks)
    .filter((v) => v.s === "no")
    .forEach((v) => {
      const m = lib.meta[filmKey(v)];
      const g = m && m.g ? normTitle(m.g) : "";
      if (!g) return;
      allKw.forEach((k) => {
        if (g.includes(k)) gp[k] = Math.min(1.2, (gp[k] || 0) + 0.3);
      });
    });
  return gp;
}

export function rankedPool(
  pool: FilmItem[],
  allSeen: SeenFilmItem[],
  lib: LibraryState,
  selectedMoods: Set<string>
): Array<{ x: FilmItem; sc: number; why: string[] }> {
  const aff = computeDecadeAffinity(allSeen);
  const gp = computeGenrePenalty(lib);
  const moodKeywords = [...selectedMoods]
    .map((l) => MOOD_GENRE_KEYWORDS[l])
    .filter(Boolean);

  return pool
    .map((x) => {
      const y = +x.y;
      const m = lib.meta[filmKey(x)];
      const g = m && m.g ? normTitle(m.g) : "";
      let sc = (y && aff[Math.floor(y / 10) * 10]) || 0;
      const why: string[] = [];
      if (y && sc > 0.3) why.push("è un'epoca in cui dai voti alti");
      if (g) {
        if (moodKeywords.some((kwList) => kwList.some((w) => g.includes(w)))) {
          sc += 1.2;
          why.push("il genere si accorda al tuo mood");
        }
        for (const k in gp) {
          if (g.includes(k)) sc -= gp[k];
        }
      }
      if (selectedMoods.has("Classico") && y) {
        if (y < 1980) {
          sc += 0.8;
          why.push("è un classico");
        } else if (y >= 2000) {
          sc -= 0.5;
        }
      }
      return { x, sc: sc + Math.random() * 0.9, why };
    })
    .sort((a, b) => b.sc - a.sc);
}

export function shortlistPool(
  pool: FilmItem[],
  allSeen: SeenFilmItem[],
  lib: LibraryState,
  selectedMoods: Set<string>,
  cap = 400
): FilmItem[] {
  if (pool.length <= cap) return pool;
  return rankedPool(pool, allSeen, lib, selectedMoods)
    .slice(0, cap)
    .map((o) => o.x);
}

export function localRecommend(
  pool: FilmItem[],
  allSeen: SeenFilmItem[],
  lib: LibraryState,
  selectedMoods: Set<string>
): RawRecommendation[] {
  return rankedPool(pool, allSeen, lib, selectedMoods)
    .slice(0, 5)
    .map((o) => {
      const m = lib.meta[filmKey(o.x)] || ({} as FilmMeta);
      return {
        tipo: "lista",
        film: canonicalLabel(o.x),
        durata: m.m ? `${m.m} min` : "",
        regista: m.d || "",
        perche:
          "Scelta con il punteggio locale: " +
          (o.why.length
            ? o.why.join(", ")
            : "rispetta i tuoi filtri ed è tra i meno esplorati") +
          ".",
      };
    });
}

export function buildTasteBlock(allSeen: SeenFilmItem[]): string {
  const rated = allSeen.filter((x) => x.r != null);
  if (!rated.length) return "Nessun voto disponibile.";
  const max = Math.max(...rated.map((x) => x.r || 0));
  const sc = max <= 5 ? 5 : 10;
  const u = sc / 5;
  const st = (x: SeenFilmItem) => (x.r || 0) / u;
  const f = (x: SeenFilmItem) =>
    `${canonicalLabel(x)} [${x.r}]${x.rw ? " (rivisto)" : ""}`;
  const by = (lo: number, hi: number) =>
    rated
      .filter((x) => st(x) >= lo && st(x) <= hi)
      .sort((p, q) => (q.r || 0) - (p.r || 0));
  const cap = (g: SeenFilmItem[], n: number) =>
    g.slice(0, n).map(f).join("; ") || "nessuno";
  const fbl = (k: OutcomeKey) =>
    allSeen
      .filter((x) => x.fb === k)
      .slice(-20)
      .map(canonicalLabel)
      .join("; ") || "nessuno";
  const rw =
    rated
      .filter((x) => x.rw)
      .slice(0, 25)
      .map(canonicalLabel)
      .join("; ") || "nessuno";

  const dec: Record<number, number[]> = {};
  rated.forEach((x) => {
    const y = +x.y;
    if (!y) return;
    const d = Math.floor(y / 10) * 10;
    (dec[d] = dec[d] || []).push(st(x));
  });
  const eps =
    Object.keys(dec)
      .filter((d) => dec[+d].length >= 5)
      .sort()
      .map(
        (d) =>
          `${d}s: ${dec[+d].length} film, media ${(
            dec[+d].reduce((p, q) => p + q, 0) / dec[+d].length
          ).toFixed(1)}★`
      )
      .join(" | ") || "-";

  return `Scala voti: ${sc === 5 ? "1-5 (stelle)" : "1-10"}.
COME USARE I VOTI: cerca la massima affinità (registi, tono, stile, epoca, tipo di storia) con gli ADORATI e gli AMATI; scarta tutto ciò che somiglia ai BOCCIATI; i film RIVISTI sono il segnale più forte; i NEUTRI servono solo a capire cosa non entusiasma. Se il MOMENTO chiede altro, il momento prevale.
ADORATI (5★): ${cap(by(4.75, 5), 45)}
AMATI (4-4.5★): ${cap(by(3.75, 4.5), 35)}
NEUTRI (3-3.5★): ${cap(by(2.75, 3.5), 12)}
BOCCIATI (2.5★ o meno): ${cap(by(0, 2.5), 30)}
RIVISTI: ${rw}
DOPO LA VISIONE (feedback dato dopo aver visto il film, pesa più dei voti): ADORATI: ${fbl(
    "love"
  )} | BELLI: ${fbl("good")} | MEH: ${fbl("meh")} | INTERROTTI (segnale negativo forte): ${fbl(
    "stop"
  )}
EPOCHE (media voto): ${eps}`;
}

export function buildSeenList(allSeen: SeenFilmItem[], limit = 600): string {
  const sorted = [...allSeen].sort((a, b) => (b.r || 0) - (a.r || 0));
  return (
    sorted
      .slice(0, limit)
      .map((x) => canonicalLabel(x) + (itTitle(x) ? ` / ${itTitle(x)}` : ""))
      .join("; ") +
    (sorted.length > limit ? " … (altri già esclusi in automatico)" : "")
  );
}

export function buildWhyBlock(why?: LibraryState["why"]): string {
  const items = (why || [])
    .slice(-15)
    .map((z) => `${z.t} (${z.y}): ${z.w}`)
    .join("; ");
  return `MOTIVI DEGLI SCARTI RECENTI (tienine conto: "Troppo lungo" = preferisci film più brevi; "Niente sottotitoli" = preferisci film parlati in italiano; "Ne ho visto uno simile" = evita per un po' lo stesso tipo di film; "Non è il mood" = il momento prevale): ${
    items || "nessuno"
  }`;
}

export function buildFilterSummary(filters: FilterConfig): string {
  return [
    filters.genres.size
      ? `generi: ${[...filters.genres]
          .map((k) => GENRE_FILTERS.find((g) => g.value === k)?.promptName || k)
          .join(" o ")}`
      : "",
    filters.minMinutes ? `durata minima ${filters.minMinutes} minuti` : "",
    filters.maxMinutes ? `durata massima ${filters.maxMinutes} minuti` : "",
    filters.countries.size
      ? `cinema ${[...filters.countries]
          .map((k) => COUNTRY_FILTERS.find((c) => c.value === k)?.promptName || k)
          .join(" o ")}`
      : "",
    filters.decades.size
      ? `anni di uscita: ${[...filters.decades]
          .map((r) => r.replace("-", " – "))
          .join(" oppure ")}`
      : "",
  ]
    .filter(Boolean)
    .join("; ");
}

export function buildRecommendPrompt(params: {
  ctx: string;
  risk: RiskMode;
  filterSummary: string;
  duo: string;
  profile: string;
  tasteBlock: string;
  discarded: string;
  whyBlock: string;
  shownExtra: string[];
  seenList: string;
  watchlistLines: string;
}): string {
  const riskLine =
    params.risk === "safe"
      ? "\nSTILE: VAI SUL SICURO. Scegli film molto vicini ai più amati dall'utente (stessi registi, generi, toni), con alta probabilità di piacergli, anche negli extra."
      : params.risk === "bold"
      ? "\nSTILE: OSA. Scegli film diversi dalla sua zona di comfort, inaspettati ma di qualità, che potrebbe non aver considerato; negli extra osa ancora di più."
      : "";

  const duoLine = params.duo
    ? `\nSERATA IN DUE: i film devono piacere a entrambi. GUSTI DELL'ALTRA PERSONA: ${params.duo}\nCerca l'incrocio tra i due gusti ed evita ciò che uno dei due detesterebbe. Nel campo "perche" di ogni film spiega cosa piace a ciascuno.`
    : "";

  return `Sei un consulente cinematografico. Scegli 9 film per l'utente: 5 DALLA WATCHLIST sotto (tipo "lista") e 4 candidati BONUS (tipo "extra", in ordine di preferenza: all'utente ne verrà mostrato solo il primo valido) che NON sono nella watchlist né tra i film già visti, ma sono affini ai suoi gusti e adatti al momento. Nel bonus puoi osare un po' di più, ma devono essere film reali e conosciuti con certezza: non inventare titoli.
MOMENTO: ${params.ctx || "nessuna indicazione, scegli varietà"}${riskLine}
FILTRI RIGIDI (valgono anche per gli extra): ${params.filterSummary || "nessuno"}${duoLine}
PROFILO GUSTI: ${params.profile || "(non disponibile)"}
GUSTI (film già visti con voto):
${params.tasteBlock}
SCARTATI DALL'UTENTE (evita film simili): ${params.discarded || "nessuno"}
${params.whyBlock}
EXTRA GIÀ PROPOSTI (non riproporre): ${params.shownExtra.join("; ") || "nessuno"}
FILM GIÀ VISTI (non suggerirli mai): ${params.seenList}

REGOLE: i film "lista" vanno copiati ESATTAMENTE come scritti nella watchlist (solo la parte "Titolo (Anno)", senza i dati dopo il simbolo |). Dove ci sono genere e durata, usali per rispettare i filtri. Rispetta durata, genere e compagnia richiesti usando ciò che sai di ogni film. Varia le scelte. Se non conosci bene un film della lista, non sceglierlo. Gli extra vanno scritti come "Titolo (Anno)".
${TITLE_RULES}
Rispondi SOLO con un array JSON di 9 oggetti (prima i 5 "lista", poi i 4 "extra"): {"tipo":"lista" oppure "extra","film":"Titolo (Anno)","durata":"es. 112 min","regista":"nome e cognome, stringa vuota se non sei sicuro","perche":"1-2 frasi in italiano che collegano il film al momento e ai film che l'utente ha amato"}.

WATCHLIST:
${params.watchlistLines}`;
}
