# PlanDoom — Roadmap di sviluppo

## Stato attuale (v0.1)
- [x] Setup Next.js 14 + TypeScript + Tailwind
- [x] Design system (palette navy/smoke/doom)
- [x] Database Supabase con schema completo (User, Folder, Event, Chip, Palette)
- [x] Autenticazione Clerk configurata
- [x] Layout principale con griglia settimanale statica
- [x] Note giornaliere e settimanali (UI skeleton)

---

## Fase 1 — Griglia funzionante (v0.2)
Obiettivo: poter creare e vedere eventi reali sulla griglia.

- [ ] Collegare Clerk al database: creare User su Supabase al primo login
- [ ] CRUD eventi base: creazione, lettura, modifica, eliminazione
- [ ] Visualizzazione eventi sulla griglia (posizionamento per ora/durata)
- [ ] Form creazione evento (modale) con campi: titolo, data, ora inizio/fine
- [ ] Navigazione settimane (avanti/indietro)
- [ ] Highlight giorno corrente
- [ ] Scroll automatico all'ora corrente al caricamento

---

## Fase 2 — Drag & Drop (v0.3)
Obiettivo: interazione fluida con gli eventi sulla griglia.

- [ ] Drag & drop eventi sulla griglia (spostamento)
- [ ] Ridimensionamento eventi (resize dal bordo inferiore)
- [ ] Shortcut tastiera: copia (Ctrl+C), incolla (Ctrl+V), taglia (Ctrl+X)
- [ ] Snap a fasce orarie durante il drag
- [ ] Feedback visivo durante il drag (ghost element)

---

## Fase 3 — Sistema Chips & Pouch (v0.4)
Obiettivo: implementare il sistema di pianificazione flessibile.

- [ ] Area Chips giornaliera (sopra ogni colonna)
- [ ] Area Chips settimanale (sidebar sinistra)
- [ ] Pouch: contenitore backlog per Chips non allocati
- [ ] Drag Chip → slot orario = conversione in Event
- [ ] Drag Event → area Chips = conversione in Chip
- [ ] Migrazione automatica Chips non completati al Pouch a fine settimana
- [ ] **VINCOLO:** Chips mai sincronizzati con servizi esterni

---

## Fase 4 — Visual Customization (v0.5)
Obiettivo: sistema hypercustom per la personalizzazione eventi.

- [ ] VisualStyle editor: shape (rectangle/rounded/pill)
- [ ] VisualStyle editor: frame (colore + spessore)
- [ ] VisualStyle editor: fill color
- [ ] VisualStyle editor: font selector
- [ ] VisualStyle editor: event type (icona/pattern)
- [ ] VisualStyle editor: checkbox interattive nel blocco evento
- [ ] Sistema Palette: Fixed Institution, Fixed Personal, Arrangeable
- [ ] Sistema Folder con associazione visual style
- [ ] Drag & drop per riordinare la palette Arrangeable

---

## Fase 5 — Seendo (v0.6)
Obiettivo: OCR agenda cartacea via Claude Vision.

- [ ] UI upload immagine (drag & drop o file picker)
- [ ] Endpoint `POST /api/seendo` con Claude Vision API
- [ ] Parsing risposta AI in lista eventi strutturata
- [ ] Modale review con checkbox per approvare/rifiutare eventi estratti
- [ ] Inserimento eventi approvati nella griglia
- [ ] Gestione errori OCR (immagine poco leggibile, ecc.)
- [ ] Storage immagini su Cloudflare R2

---

## Fase 6 — Glando (v0.7)
Obiettivo: sincronizzazione bidirezionale con Google Calendar e Notion.

- [ ] OAuth Google Calendar (login + permessi)
- [ ] Importazione eventi Google Calendar → PlanDoom
- [ ] Esportazione eventi PlanDoom → Google Calendar
- [ ] Webhook Google Calendar per sync real-time
- [ ] OAuth Notion
- [ ] Importazione/esportazione eventi Notion
- [ ] Background job Inngest per reconciliation periodica
- [ ] UI pannello Glando: stato sync, log errori, toggle per calendario
- [ ] **VINCOLO:** Chips mai inclusi nella sincronizzazione

---

## Fase 7 — Plando (v0.8)
Obiettivo: ottimizzazione AI del calendario.

- [ ] UI pannello Plando con parametri configurabili
- [ ] Endpoint `POST /api/plando` con Claude API
- [ ] Analisi calendario corrente + Chips non allocati
- [ ] Suggerimento posizionamento Chips liberi
- [ ] Suggerimento riordino eventi flessibili (`isFlexible: true`)
- [ ] Preview modifiche proposte con diff visivo
- [ ] Accettazione/rifiuto suggerimenti (bulk o singolo)

---

## Fase 8 — Polish & Deploy (v1.0)
Obiettivo: app pronta per utenti reali.

- [ ] Vista giornaliera (Daily View)
- [ ] Vista mensile (Monthly View)
- [ ] Ricerca eventi
- [ ] Notifiche / reminder
- [ ] Impostazioni utente (timezone, lingua, prima giornata settimana)
- [ ] Responsive mobile (layout adattivo)
- [ ] Deploy Vercel (produzione)
- [ ] Configurazione dominio custom
- [ ] Rate limiting API
- [ ] Error monitoring (Sentry)
- [ ] Analytics (Posthog o Plausible)

---

## Note architetturali

### Priorità assolute
1. I Chip non vengono MAI sincronizzati con servizi esterni
2. Il visual style è sempre salvato come JSON nel campo `visualStyle` del record
3. Ogni feature nuova va su branch separato, mai su main direttamente

### Debito tecnico da affrontare prima della v1.0
- Aggiungere tRPC per type-safety end-to-end (ora le API sono REST plain)
- Row Level Security (RLS) su Supabase prima del deploy pubblico
- Test E2E con Playwright per drag & drop e sync
