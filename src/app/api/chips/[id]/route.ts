import { NextResponse } from "next/server"
import { z } from "zod"
import { ensureUser } from "@/lib/auth"
import { db } from "@/lib/db"

const updateChipSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  area: z.enum(["daily", "weekly", "pouch"]).optional(),
  dayTarget: z.string().datetime().nullable().optional(),
})

// PUT /api/chips/:id
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.area !== undefined ? { area: data.area } : {}),
        ...(data.dayTarget !== undefined
          ? { dayTarget: data.dayTarget ? new Date(data.dayTarget) : null }
          : {}),
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
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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
