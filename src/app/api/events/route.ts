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

const createEventSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  isFlexible: z.boolean().default(false),
  folderId: z.string().optional(),
  visualStyle: visualStyleSchema.optional(),
})

// GET /api/events?from=ISO&to=ISO — eventi dell'utente in un intervallo
export async function GET(request: Request) {
  try {
    const user = await ensureUser()
    const { searchParams } = new URL(request.url)
    const from = searchParams.get("from")
    const to = searchParams.get("to")

    const events = await db.event.findMany({
      where: {
        userId: user.id,
        ...(from && to
          ? {
              startTime: { gte: new Date(from) },
              endTime: { lte: new Date(to) },
            }
          : {}),
      },
      orderBy: { startTime: "asc" },
    })

    return NextResponse.json(events)
  } catch (err) {
    if (err instanceof Error && err.message === "Non autenticato") {
      return NextResponse.json({ error: "Non autorizzato" }, { status: 401 })
    }
    return NextResponse.json({ error: "Errore interno del server" }, { status: 500 })
  }
}

// POST /api/events — crea un nuovo evento
export async function POST(request: Request) {
  try {
    const user = await ensureUser()
    const body: unknown = await request.json()
    const data = createEventSchema.parse(body)

    const event = await db.event.create({
      data: {
        title: data.title,
        description: data.description,
        startTime: new Date(data.startTime),
        endTime: new Date(data.endTime),
        isFlexible: data.isFlexible,
        folderId: data.folderId,
        visualStyle: data.visualStyle ?? undefined,
        userId: user.id,
        source: "plandoom",
      },
    })

    return NextResponse.json(event, { status: 201 })
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
