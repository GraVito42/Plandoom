import { NextResponse } from "next/server"
import { ensureUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { z } from "zod"

const patchSchema = z.object({
  importedEventIds: z.array(z.string()),
})

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
