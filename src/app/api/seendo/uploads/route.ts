import { NextResponse } from "next/server"
import { ensureUser } from "@/lib/auth"
import { db } from "@/lib/db"
import type { SeendoExtractedEvent } from "@/types"
import { z } from "zod"

const createSchema = z.object({
  imageUrl: z.string(),
  documentType: z.string().optional(),
  referencePeriod: z.string().optional(),
  timezone: z.string().optional(),
  fileSizeBytes: z.number().int().optional(),
  extractedEvents: z.array(
    z.object({
      title: z.string(),
      description: z.string().nullable(),
      date: z.string().nullable(),
      startTime: z.string().nullable(),
      endTime: z.string().nullable(),
    })
  ),
  importedEventIds: z.array(z.string()),
})

export async function GET() {
  try {
    const user = await ensureUser()
    const uploads = await db.seendoUpload.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    })
    return NextResponse.json(uploads)
  } catch {
    return NextResponse.json({ error: "Errore nel recupero degli upload" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const user = await ensureUser()
    const body: unknown = await request.json()
    const parsed = createSchema.parse(body)

    const upload = await db.seendoUpload.create({
      data: {
        userId: user.id,
        imageUrl: parsed.imageUrl,
        documentType: parsed.documentType,
        referencePeriod: parsed.referencePeriod,
        timezone: parsed.timezone,
        fileSizeBytes: parsed.fileSizeBytes,
        extractedEvents: parsed.extractedEvents as unknown as SeendoExtractedEvent[],
        importedEventIds: parsed.importedEventIds,
      },
    })
    return NextResponse.json(upload, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Errore nel salvataggio dell'upload" }, { status: 500 })
  }
}
