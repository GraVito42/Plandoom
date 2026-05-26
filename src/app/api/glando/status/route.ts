import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { ensureUser } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET() {
  try {
    const user = await ensureUser()
    const connected = user.googleTokens !== null

    let lastSync: string | null = null
    if (connected) {
      // Check when we last saw a Google-sourced event update
      const lastGoogleEvent = await db.event.findFirst({
        where: { userId: user.id, source: "google" },
        orderBy: { updatedAt: "desc" },
      })
      lastSync = lastGoogleEvent?.updatedAt.toISOString() ?? null
    }

    return NextResponse.json({ connected, lastSync })
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}

export async function DELETE() {
  try {
    const user = await ensureUser()
    await db.user.update({
      where: { id: user.id },
      data: { googleTokens: Prisma.JsonNull },
    })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
