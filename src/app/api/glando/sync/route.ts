import { NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { ensureUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { getValidTokens, gcalGet, gcalPost, gcalPut, type GoogleTokens } from "@/lib/google"

type GCalEvent = {
  id: string
  summary?: string
  description?: string
  location?: string
  start: { dateTime?: string; date?: string }
  end: { dateTime?: string; date?: string }
  status?: string
}

type GCalListResponse = {
  items?: GCalEvent[]
  nextPageToken?: string
}

// Sync window: 4 weeks around today
function syncWindow() {
  const from = new Date()
  from.setDate(from.getDate() - 7)
  const to = new Date()
  to.setDate(to.getDate() + 21)
  return { from, to }
}

export async function POST() {
  try {
    const user = await ensureUser()
    if (!user.googleTokens) {
      return NextResponse.json({ error: "Google Calendar not connected" }, { status: 400 })
    }

    let tokens = await getValidTokens(user.googleTokens as unknown as GoogleTokens)

    // Persist refreshed tokens if they changed
    if (tokens.access_token !== (user.googleTokens as unknown as GoogleTokens).access_token) {
      await db.user.update({
        where: { id: user.id },
        data: { googleTokens: tokens as unknown as Prisma.InputJsonValue },
      })
    }

    const { from, to } = syncWindow()
    const params = new URLSearchParams({
      timeMin: from.toISOString(),
      timeMax: to.toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "250",
    })

    const gcalData = await gcalGet<GCalListResponse>(
      `/calendars/primary/events?${params}`,
      tokens
    )
    const gcalEvents = (gcalData.items ?? []).filter(
      (e) => e.status !== "cancelled" && (e.start.dateTime || e.start.date)
    )

    const plandoomEvents = await db.event.findMany({
      where: { userId: user.id, startTime: { gte: from }, endTime: { lte: to } },
    })

    let created = 0, updated = 0, exported = 0

    // ── GCal → PlanDoom ──────────────────────────────────────────────────────
    for (const ge of gcalEvents) {
      const startISO = ge.start.dateTime ?? `${ge.start.date}T00:00:00Z`
      const endISO = ge.end.dateTime ?? `${ge.end.date}T23:59:59Z`
      const existing = plandoomEvents.find((e) => e.externalId === ge.id)

      if (!existing) {
        await db.event.create({
          data: {
            title: ge.summary ?? "(No title)",
            description: ge.description ?? null,
            location: ge.location ?? null,
            startTime: new Date(startISO),
            endTime: new Date(endISO),
            userId: user.id,
            source: "google",
            externalId: ge.id,
          },
        })
        created++
      } else {
        // Update if GCal title/time changed
        const titleChanged = existing.title !== (ge.summary ?? "(No title)")
        const startChanged = existing.startTime.toISOString() !== new Date(startISO).toISOString()
        const endChanged = existing.endTime.toISOString() !== new Date(endISO).toISOString()
        if (titleChanged || startChanged || endChanged) {
          await db.event.update({
            where: { id: existing.id },
            data: {
              title: ge.summary ?? "(No title)",
              description: ge.description ?? null,
              location: ge.location ?? null,
              startTime: new Date(startISO),
              endTime: new Date(endISO),
            },
          })
          updated++
        }
      }
    }

    // ── PlanDoom → GCal ──────────────────────────────────────────────────────
    const plandoomOnly = plandoomEvents.filter(
      (e) => e.source === "plandoom" && !e.externalId
    )
    for (const ev of plandoomOnly) {
      const gcalEvent = await gcalPost<GCalEvent>(
        "/calendars/primary/events",
        {
          summary: ev.title,
          description: ev.description ?? undefined,
          location: ev.location ?? undefined,
          start: { dateTime: ev.startTime.toISOString() },
          end: { dateTime: ev.endTime.toISOString() },
        },
        tokens
      )
      if (gcalEvent.id) {
        await db.event.update({
          where: { id: ev.id },
          data: { externalId: gcalEvent.id },
        })
        exported++
      }
    }

    // Push updates for PlanDoom events that already have an externalId
    const plandoomWithExternal = plandoomEvents.filter(
      (e) => e.source === "plandoom" && e.externalId
    )
    for (const ev of plandoomWithExternal) {
      await gcalPut<GCalEvent>(
        `/calendars/primary/events/${ev.externalId}`,
        {
          summary: ev.title,
          description: ev.description ?? undefined,
          location: ev.location ?? undefined,
          start: { dateTime: ev.startTime.toISOString() },
          end: { dateTime: ev.endTime.toISOString() },
        },
        tokens
      )
    }

    return NextResponse.json({ created, updated, exported })
  } catch (err) {
    console.error("Glando sync error:", err)
    return NextResponse.json({ error: "Sync failed" }, { status: 500 })
  }
}
