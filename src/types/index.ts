export type FolderSymbol = {
  icon: string | null          // lucide icon name; null when using customImage
  customImage?: string | null  // base64 data URL of uploaded PNG
  color: string
  size: number  // px value, 12–96
  position: { x: number; y: number } | null  // normalized [0,1]; null = default center
}

export type VisualStyle = {
  shape: "rectangle" | "rounded" | "pill"
  frameColor: string
  frameWidth: number
  sideColor: string
  sideWidth: number
  fillColor: string
  fillOpacity: number       // 0-100: fill transparency; 100 = fully opaque
  textColor: string
  fontFamily: string
  hasCheckbox: boolean
  isChecked: boolean
  eventType: string
  shapePath: string | null  // SVG path with objectBoundingBox coords (0-1); null = use shape+radius fallback
  shapeSmoothing: number    // 0 = sharp corners, 100 = max cardinal-spline smoothing
  textPosition: { x: number; y: number } | null  // normalized [0,1]; null = standard padding layout
  widthPercent: number      // 50-100: right edge of block as % of the grid column
  leftOffset: number        // 0-49: left edge of block as % of the grid column
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
  _count?: { events: number }
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
  parentEventId: string | null
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
