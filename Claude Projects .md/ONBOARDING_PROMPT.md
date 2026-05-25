# Prompt di onboarding — PlanDoom

Incolla questo all'inizio di ogni nuova chat Claude per riprendere il contesto del progetto.

---

## PROMPT DA INCOLLARE

Sto sviluppando **PlanDoom**, una web app di event management e pianificazione avanzata con personalizzazione visiva estrema ("hypercustom") e feature AI integrate.

### Stack attivo
- **Frontend:** Next.js 14 App Router + TypeScript + Tailwind CSS + shadcn/ui
- **Drag & drop:** dnd-kit
- **Auth:** Clerk (configurato, keyless mode attivo)
- **Database:** PostgreSQL su Supabase (schema pushato con 5 tabelle: User, Folder, Event, Chip, Palette)
- **ORM:** Prisma 7
- **AI:** Anthropic SDK (@anthropic-ai/sdk)
- **State:** TanStack Query

### Repo GitHub
https://github.com/GraVito42/Plandoom

### Stato attuale
- Setup completo e funzionante
- Design system attivo: palette navy/smoke/doom-gold
- Griglia settimanale statica visibile su localhost:3000
- Clerk integrato nel layout
- Database connesso via connection pooler Supabase (porta 6543)

### Prossimo step (Fase 1 della roadmap)
Rendere la griglia funzionante con eventi reali:
1. Collegare Clerk al DB: creare User su Supabase al primo login
2. CRUD eventi base
3. Visualizzazione eventi sulla griglia
4. Form creazione evento (modale)
5. Navigazione settimane

### File di riferimento nel progetto
- `CLAUDE.md` — contesto completo, design system, schema DB, regole critiche, convenzioni
- `ROADMAP.md` — piano di sviluppo completo dalla v0.1 alla v1.0
- `prisma/schema.prisma` — schema database completo
- `src/app/layout.tsx` — layout principale con Clerk
- `src/proxy.ts` — middleware Clerk

### Regole critiche da non dimenticare
1. I **Chip non vengono MAI sincronizzati** con Google Calendar o Notion
2. Il campo `visualStyle` è sempre JSON con shape/frame/color/font/type/checkbox
3. Ogni feature nuova va su **branch separato**, mai pushare direttamente su main
4. Prisma legge `.env`, non `.env.local` — DATABASE_URL va in `.env`
5. La connection string Supabase usa il **connection pooler** (porta 6543), non la direct connection (porta 5432)

### Identità visiva
- Sfondo: `navy-950` (#050818)
- Testo principale: `smoke-100`
- Accenti: `doom-gold` (#c9a84c)
- Stile: minimalismo dark + estetica medievale/esoterica
- I tre "Golem" del sistema: **Seendo** (OCR), **Glando** (sync), **Plando** (AI optimization)

Leggi il CLAUDE.md nella root del progetto per il contesto completo, poi aiutami con [DESCRIVI QUI IL TUO TASK].
