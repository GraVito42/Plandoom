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
  textColor: z.string(),
  eventType: z.string(),
  fontFamily: z.string(),
  hasCheckbox: z.boolean(),
  isChecked: z.boolean(),
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
})

export async function GET(request: Request) {
  try {
    const user = await ensureUser()
    const { searchParams } = new URL(request.url)
    const from = searchParams.get("from")
    const to = searchParams.get("to")

    const events = await db.event.findMany({
      where: {
        userId: user.id,
        ...(from && to
          ? { startTime: { gte: new Date(from) }, endTime: { lte: new Date(to) } }
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

export async function POST(request: Request) {
  try {
    const user = await ensureUser()
    const body: unknown = await request.json()
    const data = createEventSchema.parse(body)

    const event = await db.event.create({
      data: {
        title: data.title,
        description: data.description,
        startTime: new Date(data.startTime),
        endTime: new Date(data.endTime),
        isFlexible: data.isFlexible,
        isFullDay: data.isFullDay,
        timezone: data.timezone,
        qualitativeTiming: data.qualitativeTiming,
        location: data.location,
        locationUrl: data.locationUrl,
        repetition: data.repetition as unknown as Prisma.InputJsonValue ?? undefined,
        folderId: data.folderId,
        visualStyle: data.visualStyle as unknown as Prisma.InputJsonValue ?? undefined,
        mentalEnergy: data.mentalEnergy,
        physicalEnergy: data.physicalEnergy,
        difficulty: data.difficulty,
        pleasure: data.pleasure,
        isFixed: data.isFixed,
        productivityModel: data.productivityModel,
        folderFieldValues: data.folderFieldValues as unknown as Prisma.InputJsonValue ?? undefined,
        userId: user.id,
        source: "plandoom",
      },
    })

    return NextResponse.json(event, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid data", details: err.issues }, { status: 400 })
    }
    if (err instanceof Error && err.message === "Non autenticato") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
