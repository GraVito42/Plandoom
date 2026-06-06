import { NextResponse } from "next/server"
import { ensureUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { deleteFromReading } from "@/lib/r2"
import { z } from "zod"

const patchSchema = z.object({
  importedEventIds: z.array(z.string()),
})

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await ensureUser()
    const { id } = await params
    const upload = await db.seendoUpload.findUnique({ where: { id } })
    if (!upload || upload.userId !== user.id) {
      return NextResponse.json({ error: "Upload non trovato" }, { status: 404 })
    }
    return NextResponse.json(upload)
  } catch {
    return NextResponse.json({ error: "Errore nel recupero" }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await ensureUser()
    const { id } = await params
    const body: unknown = await request.json()
    const parsed = patchSchema.parse(body)

    const upload = await db.seendoUpload.findUnique({ where: { id } })
    if (!upload || upload.userId !== user.id) {
      return NextResponse.json({ error: "Upload non trovato" }, { status: 404 })
    }

    const updated = await db.seendoUpload.update({
      where: { id },
      data: { importedEventIds: parsed.importedEventIds },
    })
    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: "Errore nell'aggiornamento" }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await ensureUser()
    const { id } = await params

    const upload = await db.seendoUpload.findUnique({ where: { id } })
    if (!upload || upload.userId !== user.id) {
      return NextResponse.json({ error: "Upload non trovato" }, { status: 404 })
    }

    // Ricava la chiave R2 strippando il prefisso dell'URL pubblico
    const publicUrl = process.env.CLOUDFLARE_R2_READING_PUBLIC_URL ?? ""
    const r2Key = upload.imageUrl.startsWith(publicUrl + "/")
      ? upload.imageUrl.slice(publicUrl.length + 1)
      : upload.imageUrl

    await deleteFromReading(r2Key)

    // Decrementa storage utente se la dimensione del file è nota
    const ops: Promise<unknown>[] = [db.seendoUpload.delete({ where: { id } })]
    if (upload.fileSizeBytes) {
      ops.push(
        db.user.update({
          where: { id: user.id },
          data: { seendoStorageBytes: { decrement: upload.fileSizeBytes } },
        })
      )
    }
    await Promise.all(ops)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[DELETE /api/seendo/uploads/[id]]", err)
    return NextResponse.json({ error: "Errore interno" }, { status: 500 })
  }
}
