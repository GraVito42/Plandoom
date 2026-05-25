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

// Risposta API per un evento (date serializzate come stringhe ISO)
export type ApiEvent = {
  id: string
  title: string
  description: string | null
  startTime: string
  endTime: string
  isFlexible: boolean
  userId: string
  folderId: string | null
  visualStyle: unknown
  externalId: string | null
  source: string | null
  createdAt: string
  updatedAt: string
}
