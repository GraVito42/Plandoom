import { NextResponse } from "next/server"
import { z } from "zod"
import { Prisma } from "@prisma/client"
import { ensureUser } from "@/lib/auth"
import { db } from "@/lib/db"

const visualStyleSchema = z.object({
  shape: z.enum(["rectangle", "rounded", "pill"]),
  frameColor: z.string(),
  frameWidth: z.number(),
  sideColor: z.string(),
  sideWidth: z.number(),
  fillColor: z.string(),
  fillOpacity: z.number().min(0).max(100).optional(),
  textColor: z.string(),
  eventType: z.string(),
  fontFamily: z.string(),
  hasCheckbox: z.boolean(),
  isChecked: z.boolean(),
  shapePath: z.string().nullable().optional(),
  shapeSmoothing: z.number().min(0).max(100).optional(),
  textPosition: z.object({ x: z.number(), y: z.number() }).nullable().optional(),
  widthPercent: z.number().min(50).max(100).optional(),
  leftOffset: z.number().min(0).max(49).optional(),
})

const repetitionSchema = z.object({
  type: z.enum(["daily", "weekly", "monthly", "yearly"]),
  days: z.array(z.string()).optional(),
  endDate: z.string().optional(),
  count: z.number().int().optional(),
})

const createEventSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  isFlexible: z.boolean().default(false),
  isFullDay: z.boolean().default(false),
  timezone: z.string().optional(),
  qualitativeTiming: z.string().optional(),
  location: z.string().optional(),
  locationUrl: z.string().optional(),
  repetition: repetitionSchema.optional(),
  folderId: z.string().optional(),
  visualStyle: visualStyleSchema.optional(),
  mentalEnergy: z.number().int().min(0).max(100).optional(),
  physicalEnergy: z.number().int().min(0).max(100).optional(),
  difficulty: z.number().int().min(0).max(100).optional(),
  pleasure: z.number().int().min(0).max(100).optional(),
  isFixed: z.boolean().default(false),
  productivityModel: z.string().optional(),
  folderFieldValues: z.record(z.string(), z.unknown()).optional(),
  seendoSourceUploadId: z.string().optional(),
  seendoImages: z.array(z.string()).optional(),
})

// ── Occurrence date generation ────────────────────────────────────────────────

const DAY_NAMES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]

const DEFAULT_COUNTS: Record<string, number> = {
  daily: 30,
  weekly: 52,
  monthly: 12,
  yearly: 3,
}

function generateOccurrenceDates(
  start: Date,
  end: Date,
  rep: z.infer<typeof repetitionSchema>,
): Array<{ startTime: Date; endTime: Date }> {
  const durationMs = end.getTime() - start.getTime()
  const results: Array<{ startTime: Date; endTime: Date }> = []
  const HARD_MAX = 500

  const limitDate = rep.endDate ? new Date(rep.endDate + "T23:59:59") : null
  const limitCount = rep.count ?? DEFAULT_COUNTS[rep.type] ?? 52

  if (rep.type === "weekly" && rep.days && rep.days.length > 0) {
    const cursor = new Date(start)
    for (let guard = 0; results.length < Math.min(limitCount, HARD_MAX) && guard < 10000; guard++) {
      const dayName = DAY_NAMES[cursor.getDay()]
      if (rep.days.includes(dayName)) {
        if (limitDate && cursor > limitDate) break
        results.push({ startTime: new Date(cursor), endTime: new Date(cursor.getTime() + durationMs) })
      }
      cursor.setDate(cursor.getDate() + 1)
    }
  } else {
    const cursor = new Date(start)
    while (results.length < Math.min(limitCount, HARD_MAX)) {
      if (limitDate && cursor > limitDate) break
      results.push({ startTime: new Date(cursor), endTime: new Date(cursor.getTime() + durationMs) })
      switch (rep.type) {
        case "daily":   cursor.setDate(cursor.getDate() + 1); break
        case "weekly":  cursor.setDate(cursor.getDate() + 7); break
        case "monthly": cursor.setMonth(cursor.getMonth() + 1); break
        case "yearly":  cursor.setFullYear(cursor.getFullYear() + 1); break
      }
    }
  }

  return results
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const user = await ensureUser()
    const { searchParams } = new URL(request.url)
    const from = searchParams.get("from")
    const to = searchParams.get("to")
    const folderId = searchParams.get("folderId")

    const events = await db.event.findMany({
      where: {
        userId: user.id,
        ...(folderId ? { folderId } : {}),
        ...(from && to
          ? { startTime: { lt: new Date(to) }, endTime: { gt: new Date(from) } }
          : {}),
      },
      orderBy: { startTime: "asc" },
    })

    return NextResponse.json(events)
  } catch (err) {
    if (err instanceof Error && err.message === "Non autenticato") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const user = await ensureUser()
    const body: unknown = await request.json()
    const data = createEventSchema.parse(body)

    // Risolve lo stile visivo: se il client non ne fornisce uno, usa il default
    // della folder selezionata (se presente), altrimenti quello personale dell'utente.
    let resolvedVisualStyle: Prisma.InputJsonValue | undefined =
      data.visualStyle != null
        ? (data.visualStyle as unknown as Prisma.InputJsonValue)
        : undefined

    if (resolvedVisualStyle === undefined) {
      if (data.folderId) {
        const folder = await db.folder.findUnique({
          where: { id: data.folderId },
          select: { visualStyle: true },
        })
        if (folder?.visualStyle != null) {
          resolvedVisualStyle = folder.visualStyle as Prisma.InputJsonValue
        }
      }
      if (resolvedVisualStyle === undefined && user.defaultVisualStyle != null) {
        resolvedVisualStyle = user.defaultVisualStyle as Prisma.InputJsonValue
      }
    }

    // ── LOG DIAGNOSTICO TEMPORANEO ────────────────────────────────────────────
    {
      const dvs = user.defaultVisualStyle
      const dvsDesc = dvs == null
        ? "NULL"
        : (typeof dvs === "object" && !Array.isArray(dvs))
          ? `object{${Object.keys(dvs as object).slice(0, 4).join(",")}}`
          : `${typeof dvs}`
      console.log(
        `[Events POST] vs-debug | bodyHasVS=${data.visualStyle !== undefined}` +
        ` | userDefaultVS=${dvsDesc}` +
        ` | folder=${data.folderId ?? "none"}` +
        ` | resolved=${resolvedVisualStyle != null ? "SET" : "NULL"}` +
        ` | seendo=${data.seendoSourceUploadId != null}`
      )
    }
    // ─────────────────────────────────────────────────────────────────────────

    const sharedData = {
      title: data.title,
      description: data.description,
      isFlexible: data.isFlexible,
      isFullDay: data.isFullDay,
      timezone: data.timezone,
      qualitativeTiming: data.qualitativeTiming,
      location: data.location,
      locationUrl: data.locationUrl,
      folderId: data.folderId,
      visualStyle: resolvedVisualStyle,
      mentalEnergy: data.mentalEnergy,
      physicalEnergy: data.physicalEnergy,
      difficulty: data.difficulty,
      pleasure: data.pleasure,
      isFixed: data.isFixed,
      productivityModel: data.productivityModel,
      folderFieldValues: data.folderFieldValues as unknown as Prisma.InputJsonValue ?? undefined,
      seendoSourceUploadId: data.seendoSourceUploadId,
      seendoImages: data.seendoImages as unknown as Prisma.InputJsonValue ?? undefined,
      userId: user.id,
      source: "plandoom",
    }

    if (data.repetition) {
      const occurrences = generateOccurrenceDates(
        new Date(data.startTime),
        new Date(data.endTime),
        data.repetition,
      )
      if (occurrences.length === 0) {
        const event = await db.event.create({
          data: { ...sharedData, startTime: new Date(data.startTime), endTime: new Date(data.endTime) },
        })
        return NextResponse.json(event, { status: 201 })
      }

      const [first, ...rest] = occurrences

      const parent = await db.event.create({
        data: {
          ...sharedData,
          startTime: first.startTime,
          endTime: first.endTime,
          repetition: data.repetition as unknown as Prisma.InputJsonValue,
        },
      })
      if (rest.length > 0) {
        for (const occ of rest) {
          await db.event.create({
            data: {
              ...sharedData,
              startTime: occ.startTime,
              endTime: occ.endTime,
              parentEventId: parent.id,
            },
          })
        }
      }

      return NextResponse.json({ id: parent.id, count: occurrences.length }, { status: 201 })
    }

    // No repetition — single event
    const event = await db.event.create({
      data: { ...sharedData, startTime: new Date(data.startTime), endTime: new Date(data.endTime) },
    })
    return NextResponse.json(event, { status: 201 })

  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid data", details: err.issues }, { status: 400 })
    }
    if (err instanceof Error && err.message === "Non autenticato") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    console.error("[POST /api/events] CAUGHT ERROR:", err)
    return NextResponse.json({ error: "Internal server error", detail: String(err) }, { status: 500 })
  }
}
