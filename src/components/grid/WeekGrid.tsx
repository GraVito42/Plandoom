import DayColumn from "./DayColumn"

// Etichette giorni in italiano, partendo da lunedì
const GIORNI = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"]
const ORA_INIZIO = 7
const ORA_FINE = 23

export default function WeekGrid() {
  // Ore da 7:00 a 22:00 (l'ultima riga rappresenta fino alle 23:00)
  const ore = Array.from(
    { length: ORA_FINE - ORA_INIZIO },
    (_, i) => i + ORA_INIZIO
  )

  return (
    <div className="flex flex-col h-full overflow-hidden bg-navy-950">

      {/* ── Intestazione fissa: nomi giorni + Note Giornaliere ── */}
      <div className="flex shrink-0 bg-navy-950 border-b border-smoke-700 z-10">
        {/* Angolo vuoto sopra i label orari */}
        <div className="w-16 shrink-0 border-r border-smoke-800" />

        {GIORNI.map((giorno) => (
          <div
            key={giorno}
            className="flex-1 flex flex-col border-l border-smoke-800 min-w-0"
          >
            {/* Nome giorno */}
            <div className="py-2 text-center border-b border-smoke-800">
              <span className="text-xs font-semibold tracking-widest text-smoke-400 uppercase">
                {giorno}
              </span>
            </div>

            {/* Area Note Giornaliere */}
            <div className="h-20 bg-navy-900 px-2 py-1.5">
              <p className="text-xs text-smoke-700 italic select-none">
                Note giornaliere...
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Corpo scrollabile: label orari + colonne giorni ── */}
      <div className="flex flex-1 overflow-y-auto">

        {/* Colonna label orari */}
        <div className="w-16 shrink-0 border-r border-smoke-800 bg-navy-950">
          {ore.map((ora) => (
            <div
              key={ora}
              className="h-16 flex items-start justify-end pr-3 pt-1 border-b border-smoke-800/30"
            >
              <span className="text-xs text-smoke-600">
                {String(ora).padStart(2, "0")}:00
              </span>
            </div>
          ))}
        </div>

        {/* Colonne dei 7 giorni */}
        {GIORNI.map((giorno) => (
          <DayColumn key={giorno} giorno={giorno} ore={ore} />
        ))}
      </div>
    </div>
  )
}
