// Tipi condivisi tra client e server

export type VisualStyle = {
  shape: "rectangle" | "rounded" | "pill"
  frameColor: string
  frameWidth: number
  fillColor: string
  eventType: string
  fontFamily: string
  hasCheckbox: boolean
}

export type EventSource = "plandoom" | "google" | "notion"

export type ChipArea = "daily" | "weekly" | "pouch"
