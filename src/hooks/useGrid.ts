import { useState, useMemo } from "react"

export const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
export const HOUR_START = 0
export const HOUR_END = 24
export const PX_PER_HOUR = 64 // px height per hour row (h-16)

export function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

export function useGrid() {
  const [weekStart, setWeekStart] = useState<Date>(() => getMonday(new Date()))

  const weekDays = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart)
        d.setDate(d.getDate() + i)
        return d
      }),
    [weekStart]
  )

  const weekEnd = useMemo(() => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + 7)
    return d
  }, [weekStart])

  function prevWeek() {
    setWeekStart((d) => {
      const prev = new Date(d)
      prev.setDate(prev.getDate() - 7)
      return prev
    })
  }

  function nextWeek() {
    setWeekStart((d) => {
      const next = new Date(d)
      next.setDate(next.getDate() + 7)
      return next
    })
  }

  function goToToday() {
    setWeekStart(getMonday(new Date()))
  }

  function isToday(date: Date): boolean {
    const today = new Date()
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    )
  }

  function formatWeekRange(): string {
    const end = new Date(weekStart)
    end.setDate(end.getDate() + 6)
    const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }
    const startStr = weekStart.toLocaleDateString("en-GB", opts)
    const endStr = end.toLocaleDateString("en-GB", opts)
    return `${startStr} — ${endStr} ${end.getFullYear()}`
  }

  return {
    weekStart,
    weekEnd,
    weekDays,
    prevWeek,
    nextWeek,
    goToToday,
    isToday,
    formatWeekRange,
  }
}
