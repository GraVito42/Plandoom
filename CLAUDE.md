# CLAUDE.md — PlanDoom
*Versione 2.0 — aggiornata con spec form eventi, form chips, nuovi Golem*

Questo file è il contesto condiviso per tutti gli agenti AI che lavorano su PlanDoom.
Leggilo integralmente prima di toccare qualsiasi file.

---

## Cos'è PlanDoom

PlanDoom è una web app di pianificazione e event management (stile Google Calendar / Notion Calendar) con:
- Personalizzazione visiva estrema degli eventi ("hypercustom")
- Sistema flessibile di Chips e Pouch per eventi non ancora schedulati
- Tre feature avanzate integrate nel form evento: **Seendo** (OCR), **Lindo** (sync), **Prodo** (ottimizzazione AI)

---

## Identità visiva

- **Palette principale:** blu navy + grigio fumo
- **Stile:** compromesso tra minimalismo high-tech e estetica medievale/esoterica/magica
- **Concept:** PlanDoom è "l'apocalisse dell'event management". I suoi tre Golem sono Seendo, Lindo, Prodo.
- **Tono UI:** elegante, asciutto, dark-first

### Token colore (Tailwind custom)
```js
colors: {
  navy: {
    950: '#050818',
    900: '#0a1628',
    800: '#0f2044',
    700: '#162d5e',
    600: '#1e3a78',
    500: '#2a4d96',
  },
  smoke: {
    900: '#1a1c1e',
    800: '#23262a',
    700: '#2e3236',
    600: '#3a3f45',
    500: '#484e55',
    400: '#6b7280',
    300: '#9ca3af',
    200: '#d1d5db',
    100: '#f3f4f6',
  },
  doom: {
    gold: '#c9a84c',
    ember: '#8b3a2a',
    rune: '#4a2d6b',
  }
}
```

---

## I tre Golem — Nomi aggiornati

> ⚠️ I nomi Glando e Plando sono **deprecati**. Usare sempre i nuovi nomi.

| Nome attuale | Nome deprecato | Funzione |
|---|---|---|
| **Seendo** | — | OCR agenda cartacea via Claude Vision |
| **Lindo** | ~~Glando~~ | Sync con Google Calendar e Notion |
| **Prodo** | ~~Plando~~ | Ottimizzazione AI del calendario |

---

## Struttura del progetto

```
plandoom/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   ├── (app)/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   └── week/
│   │   └── api/
│   │       ├── events/
│   │       ├── chips/
│   │       ├── folders/
│   │       ├── seendo/
│   │       └── lindo/
│   ├── components/
│   │   ├── ui/                  # shadcn (non toccare)
│   │   ├── grid/
│   │   │   ├── WeekGrid.tsx
│   │   │   ├── DayColumn.tsx
│   │   │   └── TimeSlot.tsx
│   │   ├── events/
│   │   │   ├── EventBlock.tsx
│   │   │   └── EventForm/
│   │   │       ├── EventForm.tsx          # modale principale a 3 pannelli
│   │   │       ├── tabs/
│   │   │       │   ├── StyleTab.tsx       # pannello STYLE
│   │   │       │   ├── ContentTab.tsx     # pannello centrale
│   │   │       │   └── FolderTab.tsx      # pannello FOLDER FEATURES
│   │   │       └── panels/
│   │   │           ├── LindoPanel.tsx     # bottom tab Lindo
│   │   │           ├── SeendoPanel.tsx    # bottom tab Seendo
│   │   │           └── ProDoPanel.tsx     # bottom tab Prodo
│   │   ├── chips/
│   │   │   ├── Chip.tsx
│   │   │   ├── ChipArea.tsx
│   │   │   ├── ChipForm.tsx               # form creazione chip
│   │   │   └── Pouch.tsx
│   │   └── folders/
│   │       ├── FolderManager.tsx
│   │       └── FolderFieldEditor.tsx
│   ├── lib/
│   │   ├── db.ts
│   │   ├── auth.ts
│   │   └── anthropic.ts
│   ├── server/
│   │   └── routers/
│   │       ├── events.ts
│   │       ├── chips.ts
│   │       ├── folders.ts
│   │       └── palette.ts
│   ├── types/
│   │   └── index.ts
│   └── hooks/
│       ├── useGrid.ts
│       ├── useDragDrop.ts
│       └── useChips.ts
├── prisma/
│   └── schema.prisma
├── Old/
└── CLAUDE.md
```

---

## Schema database (Prisma) — v2.0

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String   @id @default(cuid())
  clerkId   String   @unique
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  folders      Folder[]
  events       Event[]
  chips        Chip[]
  palettes     Palette[]
  folderFields FolderField[]
}

model Folder {
  id          String   @id @default(cuid())
  name        String
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  visualStyle Json?    // preimpostazione stile per tutti gli eventi della cartella
  color       String?
  icon        String?
  createdAt   DateTime @default(now())

  events       Event[]
  chips        Chip[]
  folderFields FolderField[]  // campi custom definiti per questa cartella
}

// Campi custom definiti per una cartella (es. "Lecture" ha Type e Number)
model FolderField {
  id           String  @id @default(cuid())
  folderId     String
  folder       Folder  @relation(fields: [folderId], references: [id])
  userId       String
  user         User    @relation(fields: [userId], references: [id])
  name         String  // es. "Type", "Number"
  fieldType    String  // "text" | "number" | "closed_list" | "boolean"
  options      Json?   // per fieldType="closed_list": array di stringhe es. ["Lab","Exercise","Theory"]
  order        Int     @default(0)
  createdAt    DateTime @default(now())
}

model Event {
  id          String   @id @default(cuid())
  title       String
  description String?
  startTime   DateTime
  endTime     DateTime

  // Timing avanzato
  isFullDay         Boolean  @default(false)
  timezone          String?
  qualitativeTiming String?  // "morning"|"midday"|"afternoon"|"evening"|"night" — usato se non c'è orario rigido

  // Location
  location    String?
  locationUrl String?  // link Google Maps

  // Flessibilità e ripetizione
  isFlexible    Boolean @default(false)
  repetition    Json?   // { type: "daily"|"weekly"|"monthly"|"yearly", days?: string[], endDate?: string, count?: number }

  // Relazioni
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  folderId    String?
  folder      Folder?  @relation(fields: [folderId], references: [id])

  // Stile visivo
  visualStyle Json?    // vedi tipo VisualStyle sotto

  // Sync esterno (Lindo)
  externalId      String?  // ID su Google Calendar o Notion
  source          String?  // "google" | "notion" | "plandoom"
  isExternalLinked Boolean @default(false)  // true = bordo verde sul blocco

  // Seendo: immagini correlate
  seendoImages Json?   // array di URL immagini (da Cloudflare R2)

  // Prodo: parametri ottimizzazione
  mentalEnergy   Int?   // 0-100
  physicalEnergy Int?   // 0-100
  difficulty     Int?   // 0-100
  pleasure       Int?   // 0-100
  isFixed        Boolean @default(false)  // se true, Prodo non lo sposta mai
  productivityModel String? // modello Prodo scelto dall'utente

  // Campi custom della cartella (valori)
  folderFieldValues Json?  // { fieldId: value, ... }

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Chip {
  id          String   @id @default(cuid())
  title       String
  description String?

  // Posizione nell'ecosistema PlanDoom
  area        String   @default("weekly")  // "daily" | "weekly" | "pouch"
  dayTarget   DateTime?  // se area="daily"
  weekNumber  Int?
  year        Int?

  // Dati specifici chip
  duration    Int?     // durata stimata in minuti
  location    String?
  locationUrl String?

  // Relazioni
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  folderId    String?
  folder      Folder?  @relation(fields: [folderId], references: [id])

  // Stile visivo (stesse regole degli Event)
  visualStyle Json?

  // Prodo: parametri ottimizzazione
  mentalEnergy     Int?   // 0-100
  physicalEnergy   Int?   // 0-100
  difficulty       Int?   // 0-100
  optimalityTarget Int?   // 0-100 — target desiderato dall'utente per Prodo

  // Campi custom della cartella (valori)
  folderFieldValues Json?

  // IMPORTANTE: nessun externalId, nessun source, nessun isExternalLinked
  // I Chip NON vengono MAI sincronizzati con servizi esterni

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Palette {
  id        String   @id @default(cuid())
  name      String
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  type      String   // "institution" | "personal" | "arrangeable"
  colors    Json     // array di colori ordinati
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

---

## Tipi TypeScript condivisi

```ts
// src/types/index.ts

export type VisualStyle = {
  shape: 'rectangle' | 'rounded' | 'pill'
  frameColor: string
  frameWidth: number         // spessore bordo in px
  sideColor: string          // colore barra laterale (nuovo)
  fillColor: string
  fontFamily: string
  eventType: string          // icona o pattern identificativo
  hasCheckbox: boolean
}

export type QualitativeTiming =
  | 'morning'
  | 'midday'
  | 'afternoon'
  | 'evening'
  | 'night'

export type RepetitionConfig = {
  type: 'daily' | 'weekly' | 'monthly' | 'yearly'
  days?: string[]    // per weekly: ['mon','tue',...]
  endDate?: string   // ISO date string
  count?: number     // numero di ripetizioni
}

export type FolderFieldType = 'text' | 'number' | 'closed_list' | 'boolean'
```

---

## Form Evento — Specifica UI

Il form evento è una **modale a 3 pannelli** navigabili + una **bottom bar** con tab per i Golem.

### Pannello STYLE (sinistra)
Controlli visivi per il blocco evento:
- **Frame** → color picker (custom HEX + preset palette) + input spessore
- **Side** → color picker (barra laterale colorata sul blocco)
- **Fill** → color picker + checkbox on/off
- **Font** → dropdown font
- **Shape** → dropdown (Rectangle / Rounded / Pill) + preview box interattiva
- Preview live del blocco evento mentre si modifica

### Pannello CONTENT (centro) — default all'apertura
Dati dell'evento:
- **Title** (input testo)
- **⏱ Weekday, Date – Time** + pulsante "Advanced Settings" che espande:
  - Is full day? (toggle)
  - Timezone (dropdown)
  - Qualitative Timing (checkbox multiple: Morning / Midday / Afternoon / Evening / Night)
- **📍 Location** (input testo + link Google Maps opzionale)
- **🗒 Notes** (textarea)
- **📁 Folder** (dropdown selezione cartella)
- **⚙️ Repetition** (espandibile):
  - Tipo: Daily / Weekly (+ selezione giorni) / Monthly / Yearly
  - Fine: Last date oppure N° di ripetizioni

### Pannello FOLDER FEATURES (destra)
Campi custom definiti dalla cartella selezionata:
- Mostra il titolo della cartella
- Lista dei FolderField configurati (Field #1, Field #2, ...)
- Ogni campo è renderizzato in base al suo `fieldType`:
  - `text` → input testo
  - `number` → input numerico
  - `closed_list` → dropdown con le opzioni definite
  - `boolean` → checkbox
- Pulsante ⊕ per aggiungere nuovi campi alla cartella
- **Nota:** scegliere una cartella preimposta lo stile in STYLE tab, ma l'utente può modificarlo

### Bottom bar — Tab Golem
Tre tab nella parte bassa della modale:

**Tab LINDO:**
- Notifications (configurabili per servizio)
- Google Calendar: Maps Location, Calendars (account), toggle link → dot verde se attivo
- Notion: DB reference, toggle link → dot verde se attivo
- Bordo verde sul blocco evento se `isExternalLinked = true`

**Tab SEENDO:**
- Galleria immagini correlate all'evento
- Pulsante per aggiungere foto manualmente
- Se l'evento viene da una scansione OCR: mostra l'immagine sorgente

**Tab PRODO:**
- Productivity Model → dropdown closed list
- Fixed → checkbox (se true, Prodo non sposta mai questo evento)
- Statistics (slider 0-100):
  - 🧠 Mental Energy
  - 💪 Physical Energy
  - ⚡ Difficulty / Pleasure
- Optimality → percentuale stimata dal modello AI (read-only, calcolata da Prodo)

---

## Form Chip — Specifica UI

Form più semplice, modale singola con tab PRODO in basso.

### Pannello principale
- **Title** (input testo)
- **⏱ Duration** (input numeri, in minuti)
- **📍 Location** (input testo + link Maps opzionale)
- **📁 Folder** (dropdown)
- **Number of Chips** (input numerico, default 1)

> ⚠️ **"Number of Chips" è solo un parametro UI.** Non viene salvato nel DB.
> Al submit, il frontend esegue N chiamate POST (o una con array) e crea N record `Chip` identici.
> Ogni record è indipendente e può essere successivamente modificato singolarmente.

### Tab PRODO (bottom)
- Statistics (slider 0-100):
  - 🧠 Mental Energy
  - 💪 Physical Energy
  - ⚡ Difficulty / Energy
- **Optimality Target** → input numerico 0-100 (obiettivo desiderato dall'utente, non calcolato)

---

## Regole critiche

### Chips — sincronizzazione
- I Chip **non vengono MAI sincronizzati** con Google Calendar o Notion
- Il model `Chip` non ha e non deve avere mai: `externalId`, `source`, `isExternalLinked`
- Lindo deve ignorare categoricamente tutti i record `Chip`
- Quando un Chip viene droppato su uno slot orario → diventa `Event`, il `Chip` originale viene eliminato

### Lindo — sincronizzazione
- Sincronizza solo il model `Event`
- Mai toccare `Chip`, `Folder`, `Palette`, `FolderField` durante la sync
- `isExternalLinked = true` → bordo verde visibile sul blocco evento nella griglia

### Number of Chips
- È solo logica UI, non un campo DB
- Il frontend crea N record `Chip` con gli stessi dati al submit del form
- Ogni chip creato è indipendente

### Visual Style
- Sempre salvato come JSON nel campo `visualStyle`
- Scegliere una cartella preimposta il `visualStyle` dal `visualStyle` della cartella
- L'utente può sempre sovrascrivere dopo il preset

### FolderField
- I campi custom appartengono alla cartella, non all'evento
- I valori compilati dall'utente vengono salvati in `folderFieldValues` (JSON) sull'`Event` o `Chip`

---

## Stack tecnologico

| Layer | Tool |
|---|---|
| Framework | Next.js 14 App Router |
| Styling | Tailwind CSS + shadcn/ui |
| Drag & Drop | dnd-kit |
| State / Fetch | TanStack Query |
| Auth | Clerk |
| ORM | Prisma 7 |
| Database | PostgreSQL (Supabase, connection pooler porta 6543) |
| AI | Anthropic Claude API (claude-sonnet-4-20250514) |
| Jobs | Inngest |
| Deploy | Vercel + Supabase + Cloudflare R2 |

---

## Variabili d'ambiente

```env
# .env (Prisma legge questo, non .env.local)
DATABASE_URL=postgresql://...@aws-0-eu-west-1.pooler.supabase.com:6543/postgres

# .env.local (Next.js)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
ANTHROPIC_API_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
NOTION_CLIENT_ID=
NOTION_CLIENT_SECRET=
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=
```

> ⚠️ Prisma 7 legge `.env`, non `.env.local`. Il `DATABASE_URL` va in `.env`.

---

## Convenzioni di codice

- **TypeScript strict** — no `any`, tipi espliciti ovunque
- **Componenti:** PascalCase, un componente per file
- **Hook:** prefisso `use`, camelCase
- **API routes:** camelCase
- **Nomi variabili:** inglese
- **Commenti:** italiano
- **CSS:** solo Tailwind utility classes
- **Import order:** React → librerie esterne → componenti interni → tipi

---

## Come lavorare su questo progetto

1. Leggi questo file prima di ogni sessione
2. Lavora per feature atomiche — una alla volta
3. Ogni feature = un branch separato, mai pushare su `main` direttamente
4. `npm run build` deve passare senza errori TypeScript prima di ogni commit
5. Commit message in inglese con prefisso: `feat:` `fix:` `refactor:` `style:` `docs:`
6. Non toccare mai la cartella `Old/`

---

## Priorità di sviluppo aggiornata

1. ✅ Setup Next.js + design system
2. ✅ Schema DB + Supabase
3. ✅ Autenticazione Clerk
4. ✅ Griglia settimanale (UI skeleton)
5. → **Aggiornare schema Prisma a v2.0** (nuovi campi Event, Chip, FolderField)
6. → CRUD eventi base + visualizzazione griglia
7. → Form evento completo (3 pannelli + bottom bar Golem)
8. → Form chip completo
9. → Drag & drop
10. → Sistema Chips e Pouch
11. → Palette e visual customization
12. → Seendo (OCR)
13. → Lindo (sync)
14. → Prodo (ottimizzazione AI)
15. → Polish & deploy
