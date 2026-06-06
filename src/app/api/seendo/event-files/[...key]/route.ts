import { NextResponse } from "next/server"
import { ensureUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { deleteFromStorage } from "@/lib/r2"
import type { SeendoFile } from "@/types"
import { Prisma } from "@prisma/client"

type RouteParams = { params: Promise<{ key: string[] }> }

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const user = await ensureUser()
    const { key: keyParts } = await params
    const r2Key = keyParts.join("/")

    const { searchParams } = new URL(request.url)
    const eventId = searchParams.get("eventId")
    if (!eventId) {
      return NextResponse.json({ error: "eventId obbligatorio" }, { status: 400 })
    }

    // Verifica ownership dell'evento
    const event = await db.event.findUnique({ where: { id: eventId } })
    if (!event || event.userId !== user.id) {
      return NextResponse.json({ error: "Evento non trovato" }, { status: 404 })
    }

    // Rimuove il file dal bucket R2
    await deleteFromStorage(r2Key)

    // Rimuove l'entry dall'array seendoFiles dell'evento e decrementa lo storage
    const existing = (event.seendoFiles as SeendoFile[] | null) ?? []
    const deletedFile = existing.find((f) => f.key === r2Key)
    const updated = existing.filter((f) => f.key !== r2Key)
    await Promise.all([
      db.event.update({
        where: { id: eventId },
        data: { seendoFiles: updated as unknown as Prisma.InputJsonValue },
      }),
      deletedFile
        ? db.user.update({
            where: { id: user.id },
            data: { seendoStorageBytes: { decrement: deletedFile.size } },
          })
        : Promise.resolve(),
    ])

    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error("[DELETE /api/seendo/event-files]", err)
    return NextResponse.json({ error: "Errore interno" }, { status: 500 })
  }
}
