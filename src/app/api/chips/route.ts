import { NextResponse } from "next/server"
import { z } from "zod"
import { ensureUser } from "@/lib/auth"
import { db } from "@/lib/db"

const createChipSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  area: z.enum(["daily", "weekly", "pouch"]).default("pouch"),
  dayTarget: z.string().datetime().optional(),
  weekNumber: z.number().int().optional(),
  year: z.number().int().optional(),
  folderId: z.string().optional(),
})

// GET /api/chips
// ?area=daily&weekStart=ISO&weekEnd=ISO
// ?area=weekly&weekStart=ISO&weekEnd=ISO
// ?area=pouch
export async function GET(request: Request) {
  try {
    const user = await ensureUser()
    const { searchParams } = new URL(request.url)
    const area = searchParams.get("area") as "daily" | "weekly" | "pouch" | null
    const weekStart = searchParams.get("weekStart")
    const weekEnd = searchParams.get("weekEnd")

    const chips = await db.chip.findMany({
      where: {
        userId: user.id,
        ...(area ? { area } : {}),
        ...(area === "daily" && weekStart && weekEnd
          ? { dayTarget: { gte: new Date(weekStart), lt: new Date(weekEnd) } }
          : {}),
        ...(area === "weekly" && weekStart && weekEnd
          ? { createdAt: { gte: new Date(weekStart), lt: new Date(weekEnd) } }
          : {}),
      },
      orderBy: { createdAt: "asc" },
    })

    return NextResponse.json(chips)
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}

// POST /api/chips
export async function POST(request: Request) {
  try {
    const user = await ensureUser()
    const body: unknown = await request.json()
    const data = createChipSchema.parse(body)

    const chip = await db.chip.create({
      data: {
        title: data.title,
        description: data.description,
        area: data.area,
        dayTarget: data.dayTarget ? new Date(data.dayTarget) : undefined,
        weekNumber: data.weekNumber,
        year: data.year,
        folderId: data.folderId,
        userId: user.id,
      },
    })

    return NextResponse.json(chip, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid data", details: err.issues }, { status: 400 })
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
