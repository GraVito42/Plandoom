// Server-side event operation types — REST routes live in src/app/api/events/.

export type EventCreateInput = {
  title: string
  description?: string
  startTime: string        // ISO datetime
  endTime: string          // ISO datetime
  isFlexible?: boolean
  isFullDay?: boolean
  timezone?: string
  qualitativeTiming?: string
  location?: string
  locationUrl?: string
  repetition?: {
    type: "daily" | "weekly" | "monthly" | "yearly"
    days?: string[]
    endDate?: string
    count?: number
  }
  folderId?: string
  visualStyle?: unknown
  mentalEnergy?: number
  physicalEnergy?: number
  difficulty?: number
  pleasure?: number
  isFixed?: boolean
  productivityModel?: string
  folderFieldValues?: Record<string, unknown>
}

export type EventUpdateInput = Partial<EventCreateInput> & {
  scope?: "this" | "all"
  isExternalLinked?: boolean
}
