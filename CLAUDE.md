# CLAUDE.md — PlanDoom

Questo file è il contesto condiviso per tutti gli agenti AI che lavorano su PlanDoom.
Leggilo integralmente prima di toccare qualsiasi file.

---

## Cos'è PlanDoom

PlanDoom è una web app di pianificazione e event management (stile Google Calendar / Notion Calendar) con:
- Personalizzazione visiva estrema degli eventi ("hypercustom")
- Sistema flessibile di Chips e Pouch per eventi non ancora schedulati
- Tre feature AI/avanzate: Seendo (OCR agenda), Glando (sync calendari), Plando (ottimizzazione AI)

---

## Identità visiva

- **Palette principale:** blu navy + grigio fumo
- **Stile:** compromesso tra minimalismo high-tech e estetica medievale/esoterica/magica
- **Concept:** PlanDoom è "l'apocalisse dell'event management". I suoi tre prodotti (Seendo, Glando, Plando) sono i suoi Golem incantati.
- **Tono UI:** elegante, asciutto, dark-first

### Token colore (Tailwind custom)
```js
// tailwind.config.ts — estendi così:
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

## Struttura del progetto

```
plandoom/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/             # Route group autenticazione
│   │   ├── (app)/              # Route group app principale
│   │   │   ├── layout.tsx      # Layout con sidebar
│   │   │   ├── page.tsx        # Redirect a /week
│   │   │   └── week/           # Vista settimanale (default)
│   │   └── api/                # Route API Next.js
│   │       ├── trpc/           # tRPC handler
│   │       ├── seendo/         # OCR endpoint
│   │       └── glando/         # Webhook sync
│   ├── components/
│   │   ├── ui/                 # shadcn components (non toccare)
│   │   ├── grid/               # Griglia calendario
│   │   │   ├── WeekGrid.tsx
│   │   │   ├── DayColumn.tsx
│   │   │   └── TimeSlot.tsx
│   │   ├── events/             # Blocchi evento
│   │   │   ├── EventBlock.tsx
│   │   │   └── EventEditor.tsx
│   │   ├── chips/              # Sistema Chips
│   │   │   ├── Chip.tsx
│   │   │   ├── ChipArea.tsx
│   │   │   └── Pouch.tsx
│   │   └── magic/              # Feature avanzate
│   │       ├── Seendo.tsx
│   │       ├── Glando.tsx
│   │       └── Plando.tsx
│   ├── lib/
│   │   ├── db.ts               # Prisma client singleton
│   │   ├── auth.ts             # Clerk helpers
│   │   ├── trpc.ts             # tRPC setup
│   │   └── anthropic.ts        # Anthropic SDK client
│   ├── server/
│   │   └── routers/            # tRPC routers
│   │       ├── events.ts
│   │       ├── chips.ts
│   │       ├── folders.ts
│   │       └── palette.ts
│   ├── types/
│   │   └── index.ts            # Tipi condivisi
│   └── hooks/                  # Custom React hooks
│       ├── useGrid.ts
│       ├── useDragDrop.ts
│       └── useChips.ts
├── prisma/
│   └── schema.prisma
├── Old/                        # File legacy (non toccare)
└── CLAUDE.md                   # Questo file
```

---

## Schema database (Prisma)

```prisma
// prisma/schema.prisma

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

  folders   Folder[]
  events    Event[]
  chips     Chip[]
  palettes  Palette[]
}

model Folder {
  id          String  @id @default(cuid())
  name        String
  userId      String
  user        User    @relation(fields: [userId], references: [id])
  visualStyle Json?   // combinazione di features visive della cartella
  color       String?
  icon        String?
  createdAt   DateTime @default(now())

  events      Event[]
  chips       Chip[]
}

model Event {
  id          String   @id @default(cuid())
  title       String
  description String?
  startTime   DateTime
  endTime     DateTime
  isFlexible  Boolean  @default(false)
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  folderId    String?
  folder      Folder?  @relation(fields: [folderId], references: [id])
  visualStyle Json?    // shape, frame, color, font, type, checkbox
  externalId  String?  // ID su Google Calendar o Notion
  source      String?  // "google" | "notion" | "plandoom"
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Chip {
  id          String   @id @default(cuid())
  title       String
  description String?
  area        String   @default("weekly") // "daily" | "weekly" | "pouch"
  dayTarget   DateTime? // se area="daily", a quale giorno è associato
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  folderId    String?
  folder      Folder?  @relation(fields: [folderId], references: [id])
  visualStyle Json?
  weekNumber  Int?     // settimana di appartenenza
  year        Int?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  // IMPORTANTE: i Chip non hanno mai externalId — non vengono mai sincronizzati
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

## Regole critiche

### Chips
- I Chip **non vengono mai sincronizzati** con servizi esterni (Google Calendar, Notion)
- Glando deve ignorare categoricamente tutti i record del model `Chip`
- Quando un Chip viene droppato su uno slot orario della griglia, viene convertito in `Event` e il Chip originale viene eliminato

### Sincronizzazione (Glando)
- Sincronizza solo il model `Event`
- Mai toccare `Chip`, `Folder`, `Palette` durante la sync
- La sync è bidirezionale: PlanDoom ↔ Google Calendar, PlanDoom ↔ Notion
- Usa webhook per real-time, background job (Inngest) per reconciliation

### Visual Style
- Ogni `Event` e `Chip` ha un campo `visualStyle` JSON con questa struttura:
```ts
type VisualStyle = {
  shape: 'rectangle' | 'rounded' | 'pill'
  frameColor: string
  frameWidth: number
  fillColor: string
  eventType: string    // icona o pattern
  fontFamily: string
  hasCheckbox: boolean
}
```

---

## Stack tecnologico

| Layer | Tool |
|---|---|
| Framework | Next.js 14 App Router |
| Styling | Tailwind CSS + shadcn/ui |
| Drag & Drop | dnd-kit |
| State / Fetch | TanStack Query |
| Auth | Clerk |
| ORM | Prisma |
| Database | PostgreSQL (Supabase) |
| API layer | tRPC |
| AI | Anthropic Claude API (claude-sonnet-4-20250514) |
| Jobs | Inngest |
| Deploy | Vercel + Supabase + Cloudflare R2 |

---

## Le tre feature magiche

### Seendo (AI Vision & OCR)
- L'utente carica una foto di un'agenda cartacea
- Il sistema chiama Claude API con vision per estrarre eventi e note
- Mostra i risultati in una modale con checkbox
- L'utente approva quali eventi inserire nella griglia
- Endpoint: `POST /api/seendo`

### Glando (Sync Engine)
- Collegamento bidirezionale con Google Calendar e Notion
- Real-time via webhook, reconciliation via Inngest job
- **Non tocca mai i Chip**
- Endpoint: `POST /api/glando/webhook`

### Plando (Optimization Engine)
- Usa Claude API per analizzare il calendario e suggerire ottimizzazioni
- Può suggerire dove piazzare i Chip non allocati
- Può proporre riordino degli eventi flessibili (`isFlexible: true`)
- Apre una UI dedicata con preview delle modifiche proposte

---

## Convenzioni di codice

- **TypeScript strict** — no `any`, tipi espliciti ovunque
- **Componenti:** PascalCase, un componente per file
- **Hook:** prefisso `use`, camelCase
- **Server actions / API:** camelCase
- **Nomi variabili:** inglese
- **Commenti:** italiano (siamo un progetto italiano)
- **CSS:** Tailwind utility classes, no CSS modules, no styled-components
- **Import order:** React → librerie esterne → componenti interni → tipi → stili

---

## Variabili d'ambiente necessarie

```env
# .env.local
DATABASE_URL=
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

---

## Come lavorare su questo progetto

1. **Leggi questo file prima di ogni sessione**
2. **Lavora per feature atomiche** — una funzionalità alla volta
3. **Ogni feature = un branch** — mai lavorare direttamente su `main`
4. **Testa prima di committare** — `npm run build` non deve avere errori TypeScript
5. **Commit message in inglese** con prefisso: `feat:` `fix:` `refactor:` `style:` `docs:`
6. **Non toccare mai la cartella `Old/`**

---

## Priorità di sviluppo (ordine consigliato)

1. Setup database (Prisma schema + Supabase)
2. Autenticazione (Clerk)
3. Griglia settimanale base (layout, colonne, fasce orarie)
4. Sistema eventi (CRUD + visual style base)
5. Drag & drop (griglia + ridimensionamento)
6. Sistema Chips e Pouch
7. Palette e personalizzazione visiva avanzata
8. Seendo (OCR)
9. Glando (sync)
10. Plando (ottimizzazione AI)
