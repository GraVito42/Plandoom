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
  fillOpacity: z.number().min(0).max(100).optional(),
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
})

const patchSchema = z.object({
  defaultVisualStyle: visualStyleSchema.nullable().optional(),
})

export async function GET() {
  try {
    const user = await ensureUser()
    return NextResponse.json({
      role: user.role,
      defaultVisualStyle: user.defaultVisualStyle ?? null,
    })
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await ensureUser()
    const body: unknown = await request.json()
    const data = patchSchema.parse(body)

    const updated = await db.user.update({
      where: { id: user.id },
      data: {
        defaultVisualStyle:
          data.defaultVisualStyle != null
            ? (data.defaultVisualStyle as unknown as Prisma.InputJsonValue)
            : Prisma.JsonNull,
      },
    })

    return NextResponse.json({
      role: updated.role,
      defaultVisualStyle: updated.defaultVisualStyle ?? null,
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid data", details: err.issues }, { status: 400 })
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
