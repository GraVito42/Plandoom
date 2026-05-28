export type VisualStyle = {
  shape: "rectangle" | "rounded" | "pill"
  frameColor: string
  frameWidth: number
  sideColor: string
  sideWidth: number
  fillColor: string
  textColor: string
  fontFamily: string
  hasCheckbox: boolean
  isChecked: boolean
  eventType: string
  widthPercent: number   // 50-100: right-edge of block as % of the day column
  leftOffset: number     // 0-50: left-edge of block as % of the day column
}

export type QualitativeTiming = "morning" | "midday" | "afternoon" | "evening" | "night"

export type RepetitionConfig = {
  type: "daily" | "weekly" | "monthly" | "yearly"
  days?: string[]
  endDate?: string
  count?: number
}

export type FolderFieldType = "text" | "number" | "closed_list" | "boolean"

export type ApiFolderField = {
  id: string
  folderId: string
  userId: string
  name: string
  fieldType: FolderFieldType
  options: string[] | null
  order: number
  createdAt: string
}

export type ApiFolder = {
  id: string
  name: string
  userId: string
  visualStyle: unknown
  color: string | null
  icon: string | null
  createdAt: string
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
  isFullDay: boolean
  timezone: string | null
  qualitativeTiming: string | null
  location: string | null
  locationUrl: string | null
  repetition: unknown
  userId: string
  folderId: string | null
  visualStyle: unknown
  externalId: string | null
  source: string | null
  isExternalLinked: boolean
  seendoImages: unknown
  mentalEnergy: number | null
  physicalEnergy: number | null
  difficulty: number | null
  pleasure: number | null
  isFixed: boolean
  productivityModel: string | null
  folderFieldValues: unknown
  createdAt: string
  updatedAt: string
}

export type ApiChip = {
  id: string
  title: string
  description: string | null
  area: ChipArea
  dayTarget: string | null
  weekNumber: number | null
  year: number | null
  duration: number | null
  location: string | null
  locationUrl: string | null
  userId: string
  folderId: string | null
  visualStyle: unknown
  mentalEnergy: number | null
  physicalEnergy: number | null
  difficulty: number | null
  optimalityTarget: number | null
  folderFieldValues: unknown
  createdAt: string
  updatedAt: string
}
