import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { ensureUser } from "@/lib/auth"
import { db } from "@/lib/db"

const putBodySchema = z.object({
  content: z.unknown(),
})

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await ensureUser()
    const weekStart = req.nextUrl.searchParams.get("weekStart")
    if (!weekStart) {
      return NextResponse.json({ error: "weekStart richiesto" }, { status: 400 })
    }
    const weekStartDate = new Date(weekStart)
    if (isNaN(weekStartDate.getTime())) {
      return NextResponse.json({ error: "weekStart non valido" }, { status: 400 })
    }

    const note = await db.weeklyNote.findUnique({
      where: { userId_weekStart: { userId: user.id, weekStart: weekStartDate } },
    })

    return NextResponse.json({ content: note?.content ?? null })
  } catch {
    return NextResponse.json({ error: "Errore interno" }, { status: 500 })
  }
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await ensureUser()
    const weekStart = req.nextUrl.searchParams.get("weekStart")
    if (!weekStart) {
      return NextResponse.json({ error: "weekStart richiesto" }, { status: 400 })
    }
    const weekStartDate = new Date(weekStart)
    if (isNaN(weekStartDate.getTime())) {
      return NextResponse.json({ error: "weekStart non valido" }, { status: 400 })
    }

    const body: unknown = await req.json()
    const { content } = putBodySchema.parse(body)

    await db.weeklyNote.upsert({
      where: { userId_weekStart: { userId: user.id, weekStart: weekStartDate } },
      create: { userId: user.id, weekStart: weekStartDate, content: content as object },
      update: { content: content as object },
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Errore interno" }, { status: 500 })
  }
}
