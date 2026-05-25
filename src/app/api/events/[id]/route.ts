import { NextResponse } from "next/server"
import { z } from "zod"
import { ensureUser } from "@/lib/auth"
import { db } from "@/lib/db"

const visualStyleSchema = z.object({
  shape: z.enum(["rectangle", "rounded", "pill"]),
  frameColor: z.string(),
  frameWidth: z.number(),
  fillColor: z.string(),
  eventType: z.string(),
  fontFamily: z.string(),
  hasCheckbox: z.boolean(),
})

const updateEventSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  isFlexible: z.boolean().optional(),
  folderId: z.string().nullable().optional(),
  visualStyle: visualStyleSchema.nullable().optional(),
})

type RouteParams = { params: Promise<{ id: string }> }

// GET /api/events/[id]
export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const user = await ensureUser()
    const { id } = await params

    const event = await db.event.findUnique({ where: { id } })
    if (!event) return NextResponse.json({ error: "Evento non trovato" }, { status: 404 })
    if (event.userId !== user.id) return NextResponse.json({ error: "Non autorizzato" }, { status: 403 })

    return NextResponse.json(event)
  } catch (err) {
    if (err instanceof Error && err.message === "Non autenticato") {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 })
    }
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 })
  }
}

// PUT /api/events/[id]
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const user = await ensureUser()
    const { id } = await params

    const existing = await db.event.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: "Evento non trovato" }, { status: 404 })
    if (existing.userId !== user.id) return NextResponse.json({ error: "Non autorizzato" }, { status: 403 })

    const body: unknown = await request.json()
    const data = updateEventSchema.parse(body)

    const updated = await db.event.update({
      where: { id },
      data: {
        ...data,
        startTime: data.startTime ? new Date(data.startTime) : undefined,
        endTime: data.endTime ? new Date(data.endTime) : undefined,
        visualStyle: data.visualStyle ?? undefined,
      },
    })

    return NextResponse.json(updated)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Dati non validi", details: err.issues }, { status: 400 })
    }
    if (err instanceof Error && err.message === "Non autenticato") {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 })
    }
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 })
  }
}

// DELETE /api/events/[id]
export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const user = await ensureUser()
    const { id } = await params

    const existing = await db.event.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: "Evento non trovato" }, { status: 404 })
    if (existing.userId !== user.id) return NextResponse.json({ error: "Non autorizzato" }, { status: 403 })

    await db.event.delete({ where: { id } })
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    if (err instanceof Error && err.message === "Non autenticato") {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 })
    }
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 })
  }
}
