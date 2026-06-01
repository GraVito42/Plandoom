import { NextResponse } from "next/server"
import { ensureUser } from "@/lib/auth"

export async function GET() {
  try {
    const user = await ensureUser()
    return NextResponse.json({ role: user.role })
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
