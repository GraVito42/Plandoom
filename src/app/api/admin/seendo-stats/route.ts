import { NextResponse } from "next/server"
import { ensureAdmin } from "@/lib/auth"
import { db } from "@/lib/db"
import { SEENDO_DAILY_LIMIT, SEENDO_GLOBAL_MONTHLY_LIMIT, SEENDO_WINDOW_MS } from "@/lib/seendo-limits"

export async function GET() {
  try {
    const result = await ensureAdmin()
    if (result instanceof NextResponse) return result

    const now = new Date()
    const windowStart = new Date(now.getTime() - SEENDO_WINDOW_MS)
    const currentMonthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`

    const [activeWindowUsers, monthlyUsers, totalUsers] = await Promise.all([
      // Utenti con finestra rolling attiva nelle ultime 24h
      db.user.findMany({
        where: { seendoTokensResetAt: { gte: windowStart } },
        select: { seendoTokensUsed: true },
      }),
      // Utenti che hanno usato Seendo nel mese solare corrente
      db.user.findMany({
        where: { seendoMonthYear: currentMonthYear },
        select: { seendoTokensMonthly: true },
      }),
      db.user.count(),
    ])

    const dailyTokensUsed = activeWindowUsers.reduce((sum, u) => sum + u.seendoTokensUsed, 0)
    const monthlyTokensUsed = monthlyUsers.reduce((sum, u) => sum + u.seendoTokensMonthly, 0)

    return NextResponse.json({
      daily: {
        tokensUsed: dailyTokensUsed,
        tokensLimit: SEENDO_DAILY_LIMIT * totalUsers,
        activeUsers: activeWindowUsers.length,
      },
      monthly: {
        tokensUsed: monthlyTokensUsed,
        tokensLimit: SEENDO_GLOBAL_MONTHLY_LIMIT,
        monthYear: currentMonthYear,
      },
      totalUsers,
    })
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
