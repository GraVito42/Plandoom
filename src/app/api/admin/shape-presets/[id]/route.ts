import { NextResponse } from "next/server"
import { z } from "zod"
import { Prisma } from "@prisma/client"
import { ensureAdmin } from "@/lib/auth"
import { db } from "@/lib/db"

const visualStyleSchema = z.object({
  path: z.string(),
  smoothing: z.number().min(0).max(100).default(0),
  fillColor: z.string().optional(),
  frameColor: z.string().optional(),
})

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  visualStyle: visualStyleSchema.optional(),
})

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const result = await ensureAdmin()
    if (result instanceof NextResponse) return result

    const { id } = await params
    const body: unknown = await request.json()
    const data = updateSchema.parse(body)

    const preset = await db.shapePreset.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.visualStyle !== undefined && {
          visualStyle: data.visualStyle as unknown as Prisma.InputJsonValue,
        }),
      },
    })
    return NextResponse.json(preset)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid data", details: err.issues }, { status: 400 })
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const result = await ensureAdmin()
    if (result instanceof NextResponse) return result

    const { id } = await params
    await db.shapePreset.delete({ where: { id } })
    return new NextResponse(null, { status: 204 })
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
