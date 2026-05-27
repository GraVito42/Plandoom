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

const updateChipSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  area: z.enum(["daily", "weekly", "pouch"]).optional(),
  dayTarget: z.string().datetime().nullable().optional(),
  weekNumber: z.number().int().nullable().optional(),
  year: z.number().int().nullable().optional(),
  duration: z.number().int().min(1).nullable().optional(),
  location: z.string().nullable().optional(),
  locationUrl: z.string().nullable().optional(),
  folderId: z.string().nullable().optional(),
  visualStyle: visualStyleSchema.nullable().optional(),
  mentalEnergy: z.number().int().min(0).max(100).nullable().optional(),
  physicalEnergy: z.number().int().min(0).max(100).nullable().optional(),
  difficulty: z.number().int().min(0).max(100).nullable().optional(),
  optimalityTarget: z.number().int().min(0).max(100).nullable().optional(),
  folderFieldValues: z.record(z.string(), z.unknown()).nullable().optional(),
})

type RouteParams = { params: Promise<{ id: string }> }

// PUT /api/chips/:id
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const user = await ensureUser()
    const { id } = await params
    const chip = await db.chip.findUnique({ where: { id } })
    if (!chip || chip.userId !== user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const body: unknown = await request.json()
    const data = updateChipSchema.parse(body)

    const updated = await db.chip.update({
      where: { id },
      data: {
        ...(data.title !== undefined && { title: data.title }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.area !== undefined && { area: data.area }),
        ...(data.dayTarget !== undefined && {
          dayTarget: data.dayTarget ? new Date(data.dayTarget) : null,
        }),
        ...(data.weekNumber !== undefined && { weekNumber: data.weekNumber }),
        ...(data.year !== undefined && { year: data.year }),
        ...(data.duration !== undefined && { duration: data.duration }),
        ...(data.location !== undefined && { location: data.location }),
        ...(data.locationUrl !== undefined && { locationUrl: data.locationUrl }),
        ...(data.folderId !== undefined && { folderId: data.folderId }),
        ...(data.visualStyle !== undefined && {
          visualStyle: data.visualStyle
            ? (data.visualStyle as unknown as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        }),
        ...(data.mentalEnergy !== undefined && { mentalEnergy: data.mentalEnergy }),
        ...(data.physicalEnergy !== undefined && { physicalEnergy: data.physicalEnergy }),
        ...(data.difficulty !== undefined && { difficulty: data.difficulty }),
        ...(data.optimalityTarget !== undefined && { optimalityTarget: data.optimalityTarget }),
        ...(data.folderFieldValues !== undefined && {
          folderFieldValues: data.folderFieldValues
            ? (data.folderFieldValues as unknown as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        }),
      },
    })

    return NextResponse.json(updated)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid data", details: err.issues }, { status: 400 })
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}

// DELETE /api/chips/:id
export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const user = await ensureUser()
    const { id } = await params
    const chip = await db.chip.findUnique({ where: { id } })
    if (!chip || chip.userId !== user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    await db.chip.delete({ where: { id } })
    return new NextResponse(null, { status: 204 })
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
