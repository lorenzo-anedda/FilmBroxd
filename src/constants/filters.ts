import type { OutcomeKey } from "../types";

export const STORAGE_DATA_KEY = "wl_v1";
export const STORAGE_LIB_KEY = "wl_v2";

export const MOODS = [
  "Leggero",
  "Divertente",
  "Commovente",
  "Intenso",
  "Da brividi",
  "Cervellotico",
  "Rilassante",
  "Adrenalina",
  "Classico",
  "In due",
  "Da solo",
  "Con amici",
] as const;

export const GENRE_FILTERS = [
  { label: "Commedia", value: "co", promptName: "commedia", regex: /commedia|comedy/i },
  { label: "Drammatico", value: "dr", promptName: "drammatico", regex: /dramm|drama/i },
  { label: "Azione", value: "az", promptName: "azione", regex: /azione|action/i },
  { label: "Thriller", value: "th", promptName: "thriller", regex: /thriller|suspense/i },
  { label: "Romantico", value: "ro", promptName: "romantico", regex: /romant|sentimental|romance/i },
  { label: "Horror", value: "ho", promptName: "horror", regex: /horror|orrore/i },
  { label: "Sci-fi", value: "sf", promptName: "fantascienza", regex: /fantascienza|sci-?fi/i },
  { label: "Fantasy", value: "fa", promptName: "fantasy", regex: /fantasy|fantastic/i },
  { label: "Avventura", value: "av", promptName: "avventura", regex: /avventur|adventure/i },
  { label: "Animazione", value: "an", promptName: "animazione", regex: /animazion|animat/i },
  {
    label: "Crimine",
    value: "cr",
    promptName: "crimine",
    regex: /crimin|poliziesc|giallo|noir|crime|gangster/i,
  },
  { label: "Western", value: "we", promptName: "western", regex: /western/i },
  { label: "Documentario", value: "do", promptName: "documentario", regex: /documentar/i },
] as const;

export const COUNTRY_FILTERS = [
  { label: "Italiano", value: "it", promptName: "italiano", regex: /ital/i },
  {
    label: "Americano",
    value: "us",
    promptName: "americano",
    regex: /usa|stati uniti|america|united states|u\.s\./i,
  },
  {
    label: "Asiatico",
    value: "as",
    promptName: "asiatico",
    regex:
      /giappon|japan|core|korea|cina|china|hong kong|taiwan|thai|india|vietnam|filippin|indonesia|singapor|malesia|asia/i,
  },
  {
    label: "Europeo",
    value: "eu",
    promptName: "europeo",
    regex:
      /ital|franc|german|spagn|regno unito|ingh|\buk\b|svezi|danim|norveg|polon|belgi|olanda|paesi bassi|austria|svizzer|grecia|russia|urss|unione sovietica|ungher|cecoslov|romania|finland|portogall|irland|europ|serbia|jugoslav|bulgar|ceca|slovacch|islanda/i,
  },
] as const;

export const DECADE_FILTERS = [
  { label: "Fino al 1959", value: "0-1959" },
  { label: "’60s", value: "1960-1969" },
  { label: "’70s", value: "1970-1979" },
  { label: "’80s", value: "1980-1989" },
  { label: "’90s", value: "1990-1999" },
  { label: "2000s", value: "2000-2009" },
  { label: "2010s", value: "2010-2019" },
  { label: "Dal 2020", value: "2020-2099" },
] as const;

export const OUTCOMES: Record<OutcomeKey, { label: string; rating: number }> = {
  love: { label: "Adorato", rating: 5 },
  good: { label: "Bello", rating: 4 },
  meh: { label: "Meh", rating: 2.5 },
  stop: { label: "Interrotto", rating: 1 },
};

export const DISCARD_REASONS = [
  "Troppo lungo",
  "Niente sottotitoli",
  "Ne ho visto uno simile",
  "Non è il mood",
] as const;

export const TITLE_RULES =
  'TITOLI: per i film di registi italiani scrivi il titolo originale italiano (es. «Il conformista», non «The Conformist»); per i film di registi di altre nazionalità NON tradurre il titolo in italiano, usa il titolo originale o internazionale. I film "lista" restano copiati esattamente come nella watchlist.';
