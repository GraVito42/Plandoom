import { NextResponse } from "next/server"
import { z } from "zod"
import { Prisma } from "@prisma/client"
import { ensureUser } from "@/lib/auth"
import { db } from "@/lib/db"

const convertSchema = z.object({
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  isFlexible: z.boolean().default(false),
})

// POST /api/chips/:id/convert — atomically turns a Chip into an Event
export async function POST(
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
    const data = convertSchema.parse(body)

    const [event] = await db.$transaction([
      db.event.create({
        data: {
          title: chip.title,
          description: chip.description,
          startTime: new Date(data.startTime),
          endTime: new Date(data.endTime),
          isFlexible: data.isFlexible,
          folderId: chip.folderId,
          location: chip.location ?? undefined,
          locationUrl: chip.locationUrl ?? undefined,
          visualStyle: chip.visualStyle as Prisma.InputJsonValue ?? undefined,
          mentalEnergy: chip.mentalEnergy,
          physicalEnergy: chip.physicalEnergy,
          difficulty: chip.difficulty,
          folderFieldValues: chip.folderFieldValues as Prisma.InputJsonValue ?? undefined,
          userId: user.id,
          source: "plandoom",
        },
      }),
      db.chip.delete({ where: { id } }),
    ])

    return NextResponse.json(event, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid data", details: err.issues }, { status: 400 })
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
