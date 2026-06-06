import { NextResponse } from "next/server"
import { ensureAdmin } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET() {
  try {
    const result = await ensureAdmin()
    if (result instanceof NextResponse) return result

    const users = await db.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        seendoTokensUsed: true,
        seendoTokensResetAt: true,
        seendoStorageBytes: true,
        _count: {
          select: {
            events: true,
            chips: true,
            folders: true,
            palettes: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    })

    // BigInt non è serializzabile con JSON.stringify — converti a Number
    return NextResponse.json(
      users.map((u) => ({ ...u, seendoStorageBytes: Number(u.seendoStorageBytes) }))
    )
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
