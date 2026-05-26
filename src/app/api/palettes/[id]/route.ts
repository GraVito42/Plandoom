import { NextResponse } from "next/server"
import { z } from "zod"
import { ensureUser } from "@/lib/auth"
import { db } from "@/lib/db"

const updatePaletteSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  type: z.enum(["institution", "personal", "arrangeable"]).optional(),
  colors: z.array(z.string()).min(1).optional(),
})

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await ensureUser()
    const { id } = await params
    const palette = await db.palette.findFirst({ where: { id, userId: user.id } })
    if (!palette) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json(palette)
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await ensureUser()
    const { id } = await params
    const body: unknown = await request.json()
    const data = updatePaletteSchema.parse(body)

    const existing = await db.palette.findFirst({ where: { id, userId: user.id } })
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const palette = await db.palette.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.type !== undefined && { type: data.type }),
        ...(data.colors !== undefined && { colors: data.colors }),
      },
    })
    return NextResponse.json(palette)
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
    const user = await ensureUser()
    const { id } = await params
    const existing = await db.palette.findFirst({ where: { id, userId: user.id } })
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

    await db.palette.delete({ where: { id } })
    return new NextResponse(null, { status: 204 })
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
