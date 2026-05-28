// Server-side chip operation types — ready for tRPC wiring when needed.
// Currently these operations are handled by REST routes in src/app/api/chips/.

// Returned by GET /api/chips?area=pouch — includes past-week chips (area=weekly|daily)
export type PouchChipsQuery = {
  area: "pouch"
}

export type ChipMoveInput = {
  chipId: string
  area: "daily" | "weekly" | "pouch"
  dayTarget?: string   // ISO datetime — required when area = "daily"
  weekNumber?: number
  year?: number
}

export type ChipConvertInput = {
  chipId: string
  startTime: string    // ISO datetime
  endTime: string      // ISO datetime
  isFlexible?: boolean
}
