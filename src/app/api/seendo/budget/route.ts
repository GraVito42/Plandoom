import { NextResponse } from "next/server"
import { ensureUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { SEENDO_DAILY_LIMIT, SEENDO_DAILY_CALL_LIMIT, SEENDO_RESTRICTED_THRESHOLD, SEENDO_RESTRICTED_CALLS_THRESHOLD, SEENDO_WINDOW_MS } from "@/lib/seendo-limits"
import type { SeendoBudgetStatus } from "@/types"

export async function GET() {
  try {
    const user = await ensureUser()
    const now = new Date()

    const dbUser = await db.user.findUnique({
      where: { id: user.id },
      select: { seendoTokensUsed: true, seendoTokensResetAt: true, seendoCallsToday: true, role: true },
    })

    if (!dbUser) {
      return NextResponse.json({
        status: "active" as SeendoBudgetStatus,
        tokensUsed: 0,
        tokensLimit: SEENDO_DAILY_LIMIT,
        callsToday: 0,
        callsLimit: SEENDO_DAILY_CALL_LIMIT,
        resetAt: null,
      })
    }

    const resetAt = dbUser.seendoTokensResetAt
    let tokensUsed = dbUser.seendoTokensUsed
    let callsToday = dbUser.seendoCallsToday

    // Reset automatico se la finestra rolling 24h è scaduta
    if (!resetAt || now.getTime() - resetAt.getTime() > SEENDO_WINDOW_MS) {
      await db.user.update({
        where: { id: user.id },
        data: { seendoTokensUsed: 0, seendoTokensResetAt: now, seendoCallsToday: 0 },
      })
      tokensUsed = 0
      callsToday = 0
    }

    const windowEndsAt = resetAt
      ? new Date(resetAt.getTime() + SEENDO_WINDOW_MS)
      : new Date(now.getTime() + SEENDO_WINDOW_MS)

    let status: SeendoBudgetStatus
    if (tokensUsed >= SEENDO_DAILY_LIMIT) {
      status = "exhausted"
    } else if (dbUser.role !== "admin" && callsToday >= SEENDO_DAILY_CALL_LIMIT) {
      status = "call_exhausted"
    } else if (
      tokensUsed >= SEENDO_DAILY_LIMIT * SEENDO_RESTRICTED_THRESHOLD ||
      (dbUser.role !== "admin" && callsToday >= SEENDO_RESTRICTED_CALLS_THRESHOLD)
    ) {
      status = "restricted"
    } else {
      status = "active"
    }

    return NextResponse.json({
      status,
      tokensUsed,
      tokensLimit: SEENDO_DAILY_LIMIT,
      callsToday,
      callsLimit: SEENDO_DAILY_CALL_LIMIT,
      resetAt: windowEndsAt.toISOString(),
    })
  } catch (err) {
    console.error("[Seendo Budget] Error:", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
