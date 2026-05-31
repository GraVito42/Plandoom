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

const updateEventSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  isFlexible: z.boolean().optional(),
  isFullDay: z.boolean().optional(),
  timezone: z.string().nullable().optional(),
  qualitativeTiming: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  locationUrl: z.string().nullable().optional(),
  repetition: repetitionSchema.nullable().optional(),
  folderId: z.string().nullable().optional(),
  visualStyle: visualStyleSchema.nullable().optional(),
  mentalEnergy: z.number().int().min(0).max(100).nullable().optional(),
  physicalEnergy: z.number().int().min(0).max(100).nullable().optional(),
  difficulty: z.number().int().min(0).max(100).nullable().optional(),
  pleasure: z.number().int().min(0).max(100).nullable().optional(),
  isFixed: z.boolean().optional(),
  productivityModel: z.string().nullable().optional(),
  folderFieldValues: z.record(z.string(), z.unknown()).nullable().optional(),
  isExternalLinked: z.boolean().optional(),
  scope: z.enum(["this", "all"]).optional(),
})

type RouteParams = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const user = await ensureUser()
    const { id } = await params

    const event = await db.event.findUnique({ where: { id } })
    if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (event.userId !== user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })

    return NextResponse.json(event)
  } catch (err) {
    if (err instanceof Error && err.message === "Non autenticato") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const user = await ensureUser()
    const { id } = await params

    const existing = await db.event.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (existing.userId !== user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })

    const body: unknown = await request.json()
    const data = updateEventSchema.parse(body)

    // Non-timing fields shared across all occurrences
    const sharedPatch = {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.description !== undefined && { description: data.description }),
      ...(data.isFlexible !== undefined && { isFlexible: data.isFlexible }),
      ...(data.isFullDay !== undefined && { isFullDay: data.isFullDay }),
      ...(data.timezone !== undefined && { timezone: data.timezone }),
      ...(data.qualitativeTiming !== undefined && { qualitativeTiming: data.qualitativeTiming }),
      ...(data.location !== undefined && { location: data.location }),
      ...(data.locationUrl !== undefined && { locationUrl: data.locationUrl }),
      ...(data.folderId !== undefined && { folderId: data.folderId }),
      ...(data.visualStyle !== undefined && {
        visualStyle: data.visualStyle ? (data.visualStyle as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
      }),
      ...(data.mentalEnergy !== undefined && { mentalEnergy: data.mentalEnergy }),
      ...(data.physicalEnergy !== undefined && { physicalEnergy: data.physicalEnergy }),
      ...(data.difficulty !== undefined && { difficulty: data.difficulty }),
      ...(data.pleasure !== undefined && { pleasure: data.pleasure }),
      ...(data.isFixed !== undefined && { isFixed: data.isFixed }),
      ...(data.productivityModel !== undefined && { productivityModel: data.productivityModel }),
      ...(data.folderFieldValues !== undefined && {
        folderFieldValues: data.folderFieldValues
          ? (data.folderFieldValues as unknown as Prisma.InputJsonValue)
          : Prisma.JsonNull,
      }),
      ...(data.isExternalLinked !== undefined && { isExternalLinked: data.isExternalLinked }),
    }

    if (data.scope === "all") {
      // Apply non-timing changes to every event in the series
      const rootId = existing.parentEventId ?? existing.id
      await db.event.updateMany({
        where: { OR: [{ id: rootId }, { parentEventId: rootId }] },
        data: sharedPatch,
      })

      // Apply timing changes to this specific event (always includes startTime/endTime)
      const updated = await db.event.update({
        where: { id },
        data: {
          ...(data.startTime !== undefined && { startTime: new Date(data.startTime) }),
          ...(data.endTime !== undefined && { endTime: new Date(data.endTime) }),
          // Ensure at least one field is present (sharedPatch already applied via updateMany)
          updatedAt: new Date(),
        },
      })

      return NextResponse.json(updated)
    }

    // scope="this" (default) — update only this event
    const updated = await db.event.update({
      where: { id },
      data: {
        ...sharedPatch,
        ...(data.startTime !== undefined && { startTime: new Date(data.startTime) }),
        ...(data.endTime !== undefined && { endTime: new Date(data.endTime) }),
        ...(data.repetition !== undefined && {
          repetition: data.repetition ? (data.repetition as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        }),
      },
    })

    return NextResponse.json(updated)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid data", details: err.issues }, { status: 400 })
    }
    if (err instanceof Error && err.message === "Non autenticato") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    console.error("[PUT /api/events/:id]", err)
    return NextResponse.json({ error: "Internal server error", detail: String(err) }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const user = await ensureUser()
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const scope = searchParams.get("scope") ?? "this"

    const existing = await db.event.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })
    if (existing.userId !== user.id) return NextResponse.json({ error: "Unauthorized" }, { status: 403 })

    if (scope === "all") {
      const rootId = existing.parentEventId ?? existing.id
      // Delete children first (FK constraint), then root
      await db.$transaction([
        db.event.deleteMany({ where: { parentEventId: rootId } }),
        db.event.delete({ where: { id: rootId } }),
      ])
    } else {
      await db.event.delete({ where: { id } })
    }

    return new NextResponse(null, { status: 204 })
  } catch (err) {
    if (err instanceof Error && err.message === "Non autenticato") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
