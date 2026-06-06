import type { ApiEvent } from "@/types"

export function isFullDayEvent(event: ApiEvent): boolean {
  if (event.isFullDay) return true
  const start = new Date(event.startTime)
  const end = new Date(event.endTime)
  const isAtMidnight =
    start.getHours() === 0 && start.getMinutes() === 0 && start.getSeconds() === 0
  return isAtMidnight && end.getTime() - start.getTime() >= 86_400_000
}
