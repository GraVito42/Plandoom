import { NextResponse } from "next/server"
import { auth } from "@clerk/nextjs/server"
import { buildAuthUrl } from "@/lib/google"

export async function GET(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const origin = new URL(request.url).origin
  // state encodes the userId so we can look it up in the callback
  const state = Buffer.from(JSON.stringify({ userId })).toString("base64url")
  const url = buildAuthUrl(origin, state)

  return NextResponse.redirect(url)
}
