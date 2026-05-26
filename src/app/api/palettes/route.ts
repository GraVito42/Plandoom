import { NextResponse } from "next/server"
import { z } from "zod"
import { ensureUser } from "@/lib/auth"
import { db } from "@/lib/db"

const createPaletteSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(["institution", "personal", "arrangeable"]),
  colors: z.array(z.string()).min(1),
})

export async function GET() {
  try {
    const user = await ensureUser()
    const palettes = await db.palette.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    })
    return NextResponse.json(palettes)
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await ensureUser()
    const body: unknown = await request.json()
    const data = createPaletteSchema.parse(body)

    const palette = await db.palette.create({
      data: {
        name: data.name,
        type: data.type,
        colors: data.colors,
        userId: user.id,
      },
    })
    return NextResponse.json(palette, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid data", details: err.issues }, { status: 400 })
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
