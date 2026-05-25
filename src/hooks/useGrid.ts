import { useState, useMemo } from "react"

export const NOMI_GIORNI = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"]
export const ORA_INIZIO = 7
export const ORA_FINE = 23
export const PX_PER_ORA = 64 // altezza in px di ogni riga oraria (h-16)

// Restituisce il lunedì della settimana della data fornita
export function getLunedi(data: Date): Date {
  const d = new Date(data)
  const giorno = d.getDay() // 0 = domenica
  const diff = giorno === 0 ? -6 : 1 - giorno
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

export function useGrid() {
  const [inizioSettimana, setInizioSettimana] = useState<Date>(() =>
    getLunedi(new Date())
  )

  // I 7 giorni della settimana corrente
  const giorniSettimana = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(inizioSettimana)
        d.setDate(d.getDate() + i)
        return d
      }),
    [inizioSettimana]
  )

  // Primo istante della settimana successiva (usato come confine superiore nelle query)
  const fineSettimana = useMemo(() => {
    const d = new Date(inizioSettimana)
    d.setDate(d.getDate() + 7)
    return d
  }, [inizioSettimana])

  function vaiSettimanaPrec() {
    setInizioSettimana((d) => {
      const prev = new Date(d)
      prev.setDate(prev.getDate() - 7)
      return prev
    })
  }

  function vaiSettimanaSucc() {
    setInizioSettimana((d) => {
      const next = new Date(d)
      next.setDate(next.getDate() + 7)
      return next
    })
  }

  function vaiAOggi() {
    setInizioSettimana(getLunedi(new Date()))
  }

  function isOggi(data: Date): boolean {
    const oggi = new Date()
    return (
      data.getFullYear() === oggi.getFullYear() &&
      data.getMonth() === oggi.getMonth() &&
      data.getDate() === oggi.getDate()
    )
  }

  function formatRangeSettimana(): string {
    const fine = new Date(inizioSettimana)
    fine.setDate(fine.getDate() + 6)
    const opzioni: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }
    const start = inizioSettimana.toLocaleDateString("it-IT", opzioni)
    const end = fine.toLocaleDateString("it-IT", opzioni)
    return `${start} — ${end} ${fine.getFullYear()}`
  }

  return {
    inizioSettimana,
    fineSettimana,
    giorniSettimana,
    vaiSettimanaPrec,
    vaiSettimanaSucc,
    vaiAOggi,
    isOggi,
    formatRangeSettimana,
  }
}
