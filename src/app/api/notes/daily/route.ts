import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { ensureUser } from "@/lib/auth"
import { db } from "@/lib/db"

const putBodySchema = z.object({
  content: z.unknown(),
  iconColor: z.string().optional(),
})

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await ensureUser()
    const date = req.nextUrl.searchParams.get("date")
    if (!date) {
      return NextResponse.json({ error: "date richiesto" }, { status: 400 })
    }
    const dateObj = new Date(date)
    if (isNaN(dateObj.getTime())) {
      return NextResponse.json({ error: "date non valido" }, { status: 400 })
    }

    const note = await db.dailyNote.findUnique({
      where: { userId_date: { userId: user.id, date: dateObj } },
    })

    return NextResponse.json({
      content: note?.content ?? null,
      iconColor: note?.iconColor ?? null,
    })
  } catch {
    return NextResponse.json({ error: "Errore interno" }, { status: 500 })
  }
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await ensureUser()
    const date = req.nextUrl.searchParams.get("date")
    if (!date) {
      return NextResponse.json({ error: "date richiesto" }, { status: 400 })
    }
    const dateObj = new Date(date)
    if (isNaN(dateObj.getTime())) {
      return NextResponse.json({ error: "date non valido" }, { status: 400 })
    }

    const body: unknown = await req.json()
    const { content, iconColor } = putBodySchema.parse(body)

    await db.dailyNote.upsert({
      where: { userId_date: { userId: user.id, date: dateObj } },
      create: {
        userId: user.id,
        date: dateObj,
        content: content as object,
        ...(iconColor ? { iconColor } : {}),
      },
      update: {
        content: content as object,
        ...(iconColor ? { iconColor } : {}),
      },
    })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Errore interno" }, { status: 500 })
  }
}
