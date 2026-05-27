import { NextResponse } from "next/server"
import { z } from "zod"
import { Prisma } from "@prisma/client"
import { ensureUser } from "@/lib/auth"
import { db } from "@/lib/db"

const createFieldSchema = z.object({
  folderId: z.string(),
  name: z.string().min(1).max(100),
  fieldType: z.enum(["text", "number", "closed_list", "boolean"]),
  options: z.array(z.string()).optional(),
  order: z.number().int().default(0),
})

// GET /api/folder-fields?folderId=xxx
export async function GET(request: Request) {
  try {
    const user = await ensureUser()
    const { searchParams } = new URL(request.url)
    const folderId = searchParams.get("folderId")

    if (!folderId) {
      return NextResponse.json({ error: "folderId required" }, { status: 400 })
    }

    const folder = await db.folder.findUnique({ where: { id: folderId } })
    if (!folder || folder.userId !== user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const fields = await db.folderField.findMany({
      where: { folderId },
      orderBy: { order: "asc" },
    })

    return NextResponse.json(fields)
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}

// POST /api/folder-fields
export async function POST(request: Request) {
  try {
    const user = await ensureUser()
    const body: unknown = await request.json()
    const data = createFieldSchema.parse(body)

    const folder = await db.folder.findUnique({ where: { id: data.folderId } })
    if (!folder || folder.userId !== user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 })
    }

    const field = await db.folderField.create({
      data: {
        folderId: data.folderId,
        userId: user.id,
        name: data.name,
        fieldType: data.fieldType,
        options: data.options ? (data.options as unknown as Prisma.InputJsonValue) : undefined,
        order: data.order,
      },
    })

    return NextResponse.json(field, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid data", details: err.issues }, { status: 400 })
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
