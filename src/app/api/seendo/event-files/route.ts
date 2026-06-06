import { NextResponse } from "next/server"
import { ensureUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { uploadToStorage } from "@/lib/r2"
import type { SeendoFile } from "@/types"
import { Prisma } from "@prisma/client"

const MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB

const ACCEPTED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
])

export async function POST(request: Request) {
  try {
    const user = await ensureUser()
    const formData = await request.formData()

    const file = formData.get("file") as File | null
    const eventId = formData.get("eventId") as string | null

    if (!file || !eventId) {
      return NextResponse.json({ error: "file ed eventId sono obbligatori" }, { status: 400 })
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ error: "File troppo grande. Massimo 10 MB." }, { status: 413 })
    }

    // Verifica ownership dell'evento
    const event = await db.event.findUnique({ where: { id: eventId } })
    if (!event || event.userId !== user.id) {
      return NextResponse.json({ error: "Evento non trovato" }, { status: 404 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const contentType = ACCEPTED_TYPES.has(file.type) ? file.type : "application/octet-stream"
    const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
    const key = `events/${eventId}/${Date.now()}-${safeFilename}`
    const { url } = await uploadToStorage(buffer, key, contentType)

    await db.user.update({
      where: { id: user.id },
      data: { seendoStorageBytes: { increment: file.size } },
    })

    const newEntry: SeendoFile = {
      url,
      key,
      name: file.name,
      size: file.size,
      type: contentType,
    }

    // Append al JSON array esistente (read-modify-write)
    const existing = (event.seendoFiles as SeendoFile[] | null) ?? []
    await db.event.update({
      where: { id: eventId },
      data: {
        seendoFiles: [...existing, newEntry] as unknown as Prisma.InputJsonValue,
      },
    })

    return NextResponse.json({ file: newEntry }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/seendo/event-files]", err)
    return NextResponse.json({ error: "Errore interno" }, { status: 500 })
  }
}
