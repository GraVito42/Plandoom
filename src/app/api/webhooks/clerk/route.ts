import { Webhook } from "svix"
import { headers } from "next/headers"
import { NextResponse } from "next/server"
import type { WebhookEvent } from "@clerk/nextjs/server"
import { db } from "@/lib/db"

// Endpoint per i webhook Clerk (user.created, user.updated).
// Configura CLERK_WEBHOOK_SECRET nella dashboard Clerk → Webhooks.
export async function POST(request: Request) {
  const secret = process.env.CLERK_WEBHOOK_SECRET
  if (!secret) {
    return NextResponse.json(
      { error: "CLERK_WEBHOOK_SECRET non configurato" },
      { status: 400 }
    )
  }

  const headersList = await headers()
  const svixId = headersList.get("svix-id")
  const svixTimestamp = headersList.get("svix-timestamp")
  const svixSignature = headersList.get("svix-signature")

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: "Header svix mancanti" }, { status: 400 })
  }

  const payload = await request.text()
  const wh = new Webhook(secret)

  let event: WebhookEvent
  try {
    event = wh.verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as WebhookEvent
  } catch {
    return NextResponse.json({ error: "Firma webhook non valida" }, { status: 400 })
  }

  if (event.type === "user.created" || event.type === "user.updated") {
    const { id, email_addresses, first_name, last_name } = event.data
    const email = email_addresses[0]?.email_address ?? ""
    const name = [first_name, last_name].filter(Boolean).join(" ") || null

    await db.user.upsert({
      where: { clerkId: id },
      create: { clerkId: id, email, name },
      update: { email, name },
    })
  }

  return NextResponse.json({ received: true })
}
