import { NextResponse } from "next/server"
import { z } from "zod"
import { ensureUser } from "@/lib/auth"
import { db } from "@/lib/db"

const createFolderSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().optional(),
  icon: z.string().optional(),
})

export async function GET() {
  try {
    const user = await ensureUser()
    const folders = await db.folder.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
    })
    return NextResponse.json(folders)
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await ensureUser()
    const body: unknown = await request.json()
    const data = createFolderSchema.parse(body)

    const folder = await db.folder.create({
      data: {
        name: data.name,
        color: data.color,
        icon: data.icon,
        userId: user.id,
      },
    })

    return NextResponse.json(folder, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid data", details: err.issues }, { status: 400 })
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
