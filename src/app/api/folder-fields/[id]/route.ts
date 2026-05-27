import { NextResponse } from "next/server"
import { z } from "zod"
import { Prisma } from "@prisma/client"
import { ensureUser } from "@/lib/auth"
import { db } from "@/lib/db"

const updateFieldSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  fieldType: z.enum(["text", "number", "closed_list", "boolean"]).optional(),
  options: z.array(z.string()).nullable().optional(),
  order: z.number().int().optional(),
})

type RouteParams = { params: Promise<{ id: string }> }

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const user = await ensureUser()
    const { id } = await params

    const field = await db.folderField.findUnique({ where: { id } })
    if (!field || field.userId !== user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const body: unknown = await request.json()
    const data = updateFieldSchema.parse(body)

    const updated = await db.folderField.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.fieldType !== undefined && { fieldType: data.fieldType }),
        ...(data.options !== undefined && {
          options: data.options
            ? (data.options as unknown as Prisma.InputJsonValue)
            : Prisma.JsonNull,
        }),
        ...(data.order !== undefined && { order: data.order }),
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

    const field = await db.folderField.findUnique({ where: { id } })
    if (!field || field.userId !== user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    await db.folderField.delete({ where: { id } })
    return new NextResponse(null, { status: 204 })
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
