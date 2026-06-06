import type { ApiEvent } from "@/types"

export function isFullDayEvent(event: ApiEvent): boolean {
  if (event.isFullDay) return true
  const start = new Date(event.startTime)
  const end = new Date(event.endTime)
  const isAtMidnight =
    start.getHours() === 0 && start.getMinutes() === 0 && start.getSeconds() === 0
  return isAtMidnight && end.getTime() - start.getTime() >= 86_400_000
}

export function fillWithOpacity(color: string, opacity: number): string {
  if (opacity >= 100 || color === "transparent") return color
  const hex = color.startsWith("#") ? color.slice(1) : null
  if (!hex || (hex.length !== 6 && hex.length !== 3)) return color
  const r = parseInt(hex.length === 3 ? hex[0] + hex[0] : hex.slice(0, 2), 16)
  const g = parseInt(hex.length === 3 ? hex[1] + hex[1] : hex.slice(2, 4), 16)
  const b = parseInt(hex.length === 3 ? hex[2] + hex[2] : hex.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${(opacity / 100).toFixed(2)})`
}

// Restituisce "#ffffff" o "#000000" in base alla luminanza percepita del colore
export function getAutoTextColor(hex: string): string {
  const clean = hex.startsWith("#") ? hex.slice(1) : hex
  if (clean.length !== 6 && clean.length !== 3) return "#ffffff"
  const r = parseInt(clean.length === 3 ? clean[0] + clean[0] : clean.slice(0, 2), 16)
  const g = parseInt(clean.length === 3 ? clean[1] + clean[1] : clean.slice(2, 4), 16)
  const b = parseInt(clean.length === 3 ? clean[2] + clean[2] : clean.slice(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5 ? "#000000" : "#ffffff"
}

export function parsePillStyle(visualStyle: unknown): {
  backgroundColor: string
  border: string
  color: string
  fontFamily: string | undefined
} {
  const vs = visualStyle as Record<string, unknown> | null | undefined
  const fillColor = typeof vs?.fillColor === "string" ? vs.fillColor : "#0f2044"
  const fillOpacity = typeof vs?.fillOpacity === "number" ? vs.fillOpacity : 100
  const frameColor = typeof vs?.frameColor === "string" ? vs.frameColor : "transparent"
  const frameWidth = typeof vs?.frameWidth === "number" ? vs.frameWidth : 0
  const fontFamily = typeof vs?.fontFamily === "string" && vs.fontFamily !== "inherit"
    ? vs.fontFamily
    : undefined

  const backgroundColor = fillWithOpacity(fillColor, fillOpacity)
  const border =
    frameWidth > 0 && frameColor !== "transparent"
      ? `${frameWidth}px solid ${frameColor}`
      : "1px solid rgba(201,168,76,0.3)"

  const color = typeof vs?.textColor === "string" ? vs.textColor : getAutoTextColor(fillColor)

  return { backgroundColor, border, color, fontFamily }
}
