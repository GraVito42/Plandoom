import { NextResponse } from "next/server"

// Google Calendar push notifications — we receive a ping here when any
// calendar event changes. We trigger a lightweight sync to reconcile.
// To register a watch: POST /calendars/primary/events/watch with
//   { id: uuid, type: "web_hook", address: "<origin>/api/glando/webhook" }
export async function POST(request: Request) {
  const channelId = request.headers.get("X-Goog-Channel-ID")
  const resourceState = request.headers.get("X-Goog-Resource-State")

  // "sync" is just the initial verification ping — no action needed
  if (resourceState === "sync") {
    return new NextResponse(null, { status: 200 })
  }

  if (!channelId || !resourceState) {
    return new NextResponse(null, { status: 400 })
  }

  // For a real implementation, look up which user owns this channelId,
  // then call the sync logic for that user.
  // For now we acknowledge the webhook and let the user trigger manual sync.
  return new NextResponse(null, { status: 200 })
}
