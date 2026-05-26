export type VisualStyle = {
  shape: "rectangle" | "rounded" | "pill"
  // Full border around the event block
  frameColor: string
  frameWidth: number
  // Left accent line (side stripe)
  sideColor: string
  sideWidth: number
  // Fill and text
  fillColor: string
  textColor: string
  fontFamily: string
  // Checkbox
  hasCheckbox: boolean
  isChecked: boolean
  // Other
  eventType: string
}

export type EventSource = "plandoom" | "google" | "notion"

export type ChipArea = "daily" | "weekly" | "pouch"

export type ApiEvent = {
  id: string
  title: string
  description: string | null
  location: string | null
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
