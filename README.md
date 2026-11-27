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
│   │   ├── cinemaSound.ts            # Effetti audio Web Audio per torneo e vittoria
│   │   ├── filmHelpers.ts            # Normalizzazione titoli, storico e filtri
│   │   ├── recommender.ts            # Motore di punteggio locale e builder dei prompt AI
│   │   ├── parsers.ts                # Parser JSON tollerante e import CSV/TXT
│   │   ├── posterCache.ts            # Cache persistente anteprime e colore dominante locandine
│   │   ├── profileStats.ts           # Calcolo statistiche su voti, decenni, registi e attori
│   │   ├── storage.ts                # Persistenza e migrazione su localStorage
│   │   ├── tournament.ts             # Logica tabellone a 8 o 16 film (Quarti/Ottavi-Finale)
│   │   └── filmLogic.ts              # Barrel di compatibilità verso i moduli utils
│   └── components/
│       ├── HeaderBar.tsx             # Header sticky con logo proiettore animato e navigazione
│       ├── ProjectorLogo.tsx         # Logo SVG animato del proiettore cinematografico
│       ├── PosterImage.tsx           # Lazy loading locandine con IntersectionObserver e placeholder colore
│       ├── EveningControls.tsx       # Pannello mood, contesto, filtri e motore di scelta
│       ├── RecommendationsStage.tsx  # Colonna risultati e riepilogo archivio
│       ├── PickCard.tsx              # Scheda singolo film con locandina, trama e azioni
│       ├── FilmPreviewModal.tsx      # Modale anteprima ingrandita + link Letterboxd/Wiki
│       ├── CineSfidaView.tsx         # Modalità gioco ReelRouette (Quarti o Ottavi con locandine)
│       ├── CineSfidaBracket.tsx      # Tabellone visivo dai Quarti o Ottavi fino alla Finale
│       ├── CineSfidaVictory.tsx      # Schermata di vittoria a tema cinema con sipario
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

## Usare i propri dati Letterboxd (al posto della libreria precaricata)

Il repository include una libreria precaricata di partenza in `src/data/embeddedLibrary.ts` (watchlist, film visti, cronologia e profilo gusti d'esempio, più un catalogo condiviso di metadati sui film) così l'app è subito utilizzabile appena avviata.

Chi scarica o clona il progetto può sostituirla completamente con i propri dati personali in pochi secondi, senza toccare il codice:

1. **Esporta i tuoi CSV da Letterboxd**:
   - Accedi a Letterboxd → **Settings → Import & Export → Export Your Data** e scarica l'archivio `.zip`.
   - I file principali usati dall'app sono:
     - `watchlist.csv` (la tua watchlist)
     - `watched.csv` e `ratings.csv` (i tuoi film visti e i voti a mezze stelle; opzionale anche `diary.csv`)

2. **Riparti da zero o importa direttamente in `Archivio`**:
   - Apri la scheda **Archivio** nell'header dell'app.
   - Se vuoi prima azzerare tutto, clicca **Svuota tutto (riparti da zero)** per cancellare watchlist, film visti, voti, cronologia e profilo precaricati (viene conservata solo la cache pubblica di metadati/durate/generi dei film).
   - Carica `watchlist.csv` nel riquadro **Watchlist** e seleziona `watched.csv` + `ratings.csv` nel riquadro **Film visti e voti** (puoi selezionarli anche **insieme** in un solo caricamento o uno dopo l'altro: l'app fonde automaticamente i voti sui film visti senza perdere quelli senza voto).
   - Al primo import di un tuo CSV dalla libreria precaricata, l'app sostituisce automaticamente anche eventuali dati personali precaricati rimasti (profilo gusti, cronologia e lista opposta non ancora importata) e passa in modalità **Libreria personale attiva** (salvata nel `localStorage` del browser).

3. **Rigenera il tuo profilo e arricchisci i metadati**:
   - Vai nella scheda **Profilo** per vedere subito le statistiche su voti e decenni dai tuoi CSV, rigenerare il tuo profilo gusti personale con Gemini e avviare l'arricchimento di registi, attori, durate e generi.
   - Se vuoi tornare in qualsiasi momento ai dati dimostrativi originali, in **Archivio** trovi il pulsante **Ripristina libreria precaricata**.

## Funzionalità principali

- **Cosa guardiamo stasera**: scegli mood, compagnia, durata, generi, paesi, decenni e livello di rischio per ottenere 5 proposte dalla watchlist + 1 consiglio extra calibrato sul tuo gusto.
- **ReelRouette**: torneo a eliminazione diretta (8 film dai Quarti o 16 film dagli Ottavi) per decidere cosa guardare sfidando due titoli alla volta con locandine e scelta rapida da tastiera (`←`/`1`, `→`/`2`).
- **Profilo**: statistiche visive su media voti, distribuzione mezze stelle, decenni preferiti, registi e attori più visti/amati, più sintesi testuale dei gusti.
- **Cronologia & Archivio**: tracciamento delle serate precedenti, export/import backup completo `.json` e gestione CSV Letterboxd.

## Licenza

Distribuito con licenza [MIT](LICENSE).
