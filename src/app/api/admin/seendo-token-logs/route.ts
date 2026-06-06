import { NextResponse } from "next/server"
import { ensureAdmin } from "@/lib/auth"
import { db } from "@/lib/db"

export async function GET() {
  try {
    const result = await ensureAdmin()
    if (result instanceof NextResponse) return result

    const now = new Date()
    const since = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    const logs = await db.seendoTokenLog.findMany({
      where: { createdAt: { gte: since } },
      select: { tokens: true, model: true, createdAt: true },
    })

    // 24 bucket orari: indice 0 = 24h fa, indice 23 = ora corrente
    const buckets: { hour: number; tokens: number; calls: number }[] = Array.from(
      { length: 24 },
      (_, i) => ({ hour: i, tokens: 0, calls: 0 })
    )

    for (const log of logs) {
      const ageMs = now.getTime() - new Date(log.createdAt).getTime()
      const hoursAgo = Math.floor(ageMs / (60 * 60 * 1000))
      const bucketIndex = 23 - hoursAgo
      if (bucketIndex >= 0 && bucketIndex < 24) {
        buckets[bucketIndex].tokens += log.tokens
        buckets[bucketIndex].calls += 1
      }
    }

    return NextResponse.json({ buckets })
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
