"use client"

import { useQuery } from "@tanstack/react-query"
import type { ApiChip } from "@/types"

export function useChips(weekStart: Date, weekEnd: Date) {
  const { data: dailyChips = [] } = useQuery<ApiChip[]>({
    queryKey: ["chips", "daily", weekStart.toISOString()],
    queryFn: async () => {
      const res = await fetch(
        `/api/chips?area=daily&weekStart=${weekStart.toISOString()}&weekEnd=${weekEnd.toISOString()}`
      )
      if (!res.ok) throw new Error("Failed to load chips")
      return res.json() as Promise<ApiChip[]>
    },
  })

  function chipsForDay(date: Date): ApiChip[] {
    return dailyChips.filter((chip) => {
      if (!chip.dayTarget) return false
      const t = new Date(chip.dayTarget)
      return (
        t.getFullYear() === date.getFullYear() &&
        t.getMonth() === date.getMonth() &&
        t.getDate() === date.getDate()
      )
    })
  }

  return { dailyChips, chipsForDay }
}
