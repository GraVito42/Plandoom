import { NextResponse } from "next/server"
import { z } from "zod"
import { Prisma } from "@prisma/client"
import { ensureAdmin } from "@/lib/auth"

const visualStyleSchema = z.object({
  path: z.string(),
  smoothing: z.number().min(0).max(100).default(0),
  fillColor: z.string().optional(),
  frameColor: z.string().optional(),
})

const createSchema = z.object({
  name: z.string().min(1).max(100),
  visualStyle: visualStyleSchema,
})

export async function GET() {
  try {
    const result = await ensureAdmin()
    if (result instanceof NextResponse) return result

    const presets = await (await import("@/lib/db")).db.shapePreset.findMany({
      orderBy: { createdAt: "asc" },
    })
    return NextResponse.json(presets)
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}

export async function POST(request: Request) {
  try {
    const result = await ensureAdmin()
    if (result instanceof NextResponse) return result

    const body: unknown = await request.json()
    const data = createSchema.parse(body)

    const preset = await (await import("@/lib/db")).db.shapePreset.create({
      data: {
        name: data.name,
        visualStyle: data.visualStyle as unknown as Prisma.InputJsonValue,
      },
    })
    return NextResponse.json(preset, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid data", details: err.issues }, { status: 400 })
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
