# FilmBroxd

Consulente cinematografico personale per scegliere cosa guardare dalla propria watchlist Letterboxd in base a mood, filtri, storico delle visioni e gusti personali, con preview automatica di locandina e sinossi e supporto AI Gemini (con punteggio locale come fallback).

## Struttura del progetto

```text
.
├── server.ts                         # Entry point Express + Vite (dev) / static (prod)
├── server/
│   ├── routes/
│   │   ├── ai.ts                     # Endpoint /api/health e /api/ai/generate
│   │   └── preview.ts                # Endpoint /api/film/preview
│   └── services/
│       ├── geminiService.ts          # Client Gemini, retry esponenziale e gestione errori
│       └── filmPreviewService.ts     # Ricerca locandina e sinossi su Wikipedia + cache
├── src/
│   ├── App.tsx                       # Orchestrazione principale e viste tab
│   ├── main.tsx                      # Mount React
│   ├── index.css                     # Tailwind CSS v4 + animazioni proiettore
│   ├── types.ts                      # Interfacce TypeScript del dominio
│   ├── constants/
│   │   └── filters.ts                # Mood, generi, paesi, epoche, esiti e chiavi storage
│   ├── data/
│   │   └── embeddedLibrary.ts        # Watchlist, film visti, metadati e titoli italiani
│   ├── hooks/
│   │   └── useFilmPreviews.ts        # Hook per il caricamento asincrono delle locandine
│   ├── utils/
│   │   ├── aiClient.ts               # Fetch client verso /api/ai/generate e /api/film/preview
│   │   ├── filmHelpers.ts            # Normalizzazione titoli, storico e filtri
│   │   ├── recommender.ts            # Motore di punteggio locale e builder dei prompt AI
│   │   ├── parsers.ts                # Parser JSON tollerante e import CSV/TXT
│   │   ├── profileStats.ts           # Calcolo statistiche su voti, decenni, registi e attori
│   │   ├── storage.ts                # Persistenza e migrazione su localStorage
│   │   └── filmLogic.ts              # Barrel di compatibilità verso i moduli utils
│   └── components/
│       ├── HeaderBar.tsx             # Header sticky con logo proiettore animato e navigazione
│       ├── ProjectorLogo.tsx         # Logo SVG animato del proiettore cinematografico
│       ├── EveningControls.tsx       # Pannello mood, contesto, filtri e motore di scelta
│       ├── RecommendationsStage.tsx  # Colonna risultati e riepilogo archivio
│       ├── PickCard.tsx              # Scheda singolo film con locandina, trama e azioni
│       ├── FilmPreviewModal.tsx      # Modale anteprima ingrandita + link Letterboxd/Wiki
│       ├── PendingQueue.tsx          # Promemoria film scelti nelle serate precedenti
│       ├── HistoryView.tsx           # Cronologia, da vedere e scartati
│       ├── ProfileStats.tsx          # Grafici statistiche su voti, decenni, registi e attori
│       ├── ProfileView.tsx           # Profilo gusti e arricchimento metadati
│       └── ArchiveView.tsx           # Import/export Letterboxd CSV e backup JSON
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Avvio in locale

1. **Installa le dipendenze** (Node.js 20+ consigliato):
   ```bash
   npm install
   ```

2. **Configura le variabili d'ambiente**:
   Copia `.env.example` in `.env` e inserisci la tua chiave API Gemini:
   ```bash
   cp .env.example .env
   ```
   ```env
   GEMINI_API_KEY="la-tua-chiave-gemini"
   ```
   *(Senza chiave Gemini, l'app funziona comunque usando il motore di punteggio locale.)*

3. **Avvia in sviluppo** (porta `3000`):
   ```bash
   npm run dev
   ```

4. **Build di produzione e verifica tipi**:
   ```bash
   npm run lint
   npm run build
   npm start
   ```

## Licenza

Distribuito con licenza [MIT](LICENSE).

