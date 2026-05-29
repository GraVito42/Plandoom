import { NextResponse } from "next/server"
import { z } from "zod"
import { Prisma } from "@prisma/client"
import { ensureUser } from "@/lib/auth"
import { db } from "@/lib/db"

const folderSymbolSchema = z.object({
  icon: z.string().nullable(),
  customImage: z.string().nullable().optional(),
  color: z.string(),
  size: z.number().min(12).max(96),
  position: z.object({ x: z.number(), y: z.number() }).nullable(),
}).nullable().optional()

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
  shapePath: z.string().nullable().optional(),
  shapeSmoothing: z.number().min(0).max(100).optional(),
  textPosition: z.object({ x: z.number(), y: z.number() }).nullable().optional(),
  widthPercent: z.number().min(50).max(100).optional(),
  leftOffset: z.number().min(0).max(49).optional(),
  folderSymbol: folderSymbolSchema,
}).nullable().optional()

const updateFolderSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  icon: z.string().nullable().optional(),
  visualStyle: visualStyleSchema,
})

type RouteParams = { params: Promise<{ id: string }> }

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const user = await ensureUser()
    const { id } = await params

    const folder = await db.folder.findUnique({ where: { id } })
    if (!folder || folder.userId !== user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const body: unknown = await request.json()
    const data = updateFolderSchema.parse(body)

    const updated = await db.folder.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.icon !== undefined && { icon: data.icon }),
        ...(data.visualStyle !== undefined && {
          visualStyle: data.visualStyle
            ? (data.visualStyle as unknown as Prisma.InputJsonValue)
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

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const user = await ensureUser()
    const { id } = await params

    const folder = await db.folder.findUnique({ where: { id } })
    if (!folder || folder.userId !== user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    // Cascade manuale: sgancia eventi e chip, poi elimina campi e folder
    await db.$transaction([
      db.event.updateMany({ where: { folderId: id }, data: { folderId: null } }),
      db.chip.updateMany({ where: { folderId: id }, data: { folderId: null } }),
      db.folderField.deleteMany({ where: { folderId: id } }),
      db.folder.delete({ where: { id } }),
    ])

    return new NextResponse(null, { status: 204 })
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
