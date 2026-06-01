import { NextResponse } from "next/server"
import { ensureUser } from "@/lib/auth"
import { db } from "@/lib/db"

// GET /api/shape-presets — restituisce i global shape preset (read-only per tutti gli utenti)
export async function GET() {
  try {
    await ensureUser()
    const presets = await db.shapePreset.findMany({
      orderBy: { createdAt: "asc" },
    })
    return NextResponse.json(presets)
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
