import { NextResponse } from "next/server"
import { z } from "zod"
import { Prisma } from "@prisma/client"
import { ensureUser } from "@/lib/auth"
import { db } from "@/lib/db"

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
  folderSymbol: z.object({
    icon: z.string().nullable(),
    customImage: z.string().nullable().optional(),
    color: z.string(),
    size: z.number().min(12).max(96),
    position: z.object({ x: z.number(), y: z.number() }).nullable(),
  }).nullable().optional(),
})

const createFolderSchema = z.object({
  name: z.string().min(1).max(100),
  icon: z.string().optional(),
  visualStyle: visualStyleSchema.nullable().optional(),
})

export async function GET() {
  try {
    const user = await ensureUser()
    const folders = await db.folder.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { events: true } } },
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
        icon: data.icon,
        visualStyle: data.visualStyle
          ? (data.visualStyle as unknown as Prisma.InputJsonValue)
          : undefined,
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
