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

export type ApiChip = {
  id: string
  title: string
  description: string | null
  area: ChipArea
  dayTarget: string | null
  userId: string
  folderId: string | null
  visualStyle: unknown
  weekNumber: number | null
  year: number | null
  createdAt: string
  updatedAt: string
}
