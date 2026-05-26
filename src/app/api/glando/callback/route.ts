import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { exchangeCode, type GoogleTokens } from "@/lib/google"
import { ensureUser } from "@/lib/auth"

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const error = searchParams.get("error")

  if (error || !code) {
    return NextResponse.redirect(`${origin}/week?glando=error`)
  }

  try {
    const tokens: GoogleTokens = await exchangeCode(code, origin)
    const user = await ensureUser()

    const { db } = await import("@/lib/db")
    await db.user.update({
      where: { id: user.id },
      data: { googleTokens: tokens as unknown as Prisma.InputJsonValue },
    })

    return NextResponse.redirect(`${origin}/week?glando=connected`)
  } catch {
    return NextResponse.redirect(`${origin}/week?glando=error`)
  }
}
