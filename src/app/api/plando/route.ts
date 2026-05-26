import { NextResponse } from "next/server"
import { z } from "zod"
import { ensureUser } from "@/lib/auth"
import { db } from "@/lib/db"
import { anthropic } from "@/lib/anthropic"

const schema = z.object({
  weekStart: z.string().datetime(),
  weekEnd: z.string().datetime(),
})

type Suggestion =
  | {
      type: "move_event"
      eventId: string
      eventTitle: string
      currentStart: string
      currentEnd: string
      proposedStart: string
      proposedEnd: string
      reason: string
    }
  | {
      type: "schedule_chip"
      chipId: string
      chipTitle: string
      proposedStart: string
      proposedEnd: string
      reason: string
    }

function fmt(d: Date): string {
  return d.toLocaleString("en-GB", {
    weekday: "short", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone: "UTC",
  })
}

export async function POST(request: Request) {
  try {
    const user = await ensureUser()
    const body: unknown = await request.json()
    const { weekStart, weekEnd } = schema.parse(body)

    const [events, chips] = await Promise.all([
      db.event.findMany({
        where: { userId: user.id, startTime: { gte: new Date(weekStart) }, endTime: { lte: new Date(weekEnd) } },
        orderBy: { startTime: "asc" },
      }),
      db.chip.findMany({
        where: { userId: user.id, area: { in: ["pouch", "weekly"] } },
        orderBy: { createdAt: "asc" },
      }),
    ])

    const fixed = events.filter((e) => !e.isFlexible)
    const flexible = events.filter((e) => e.isFlexible)
    const todayStr = new Date().toISOString().slice(0, 10)

    const prompt = `You are Plando, the AI calendar optimizer for PlanDoom.

Today: ${todayStr}. Analyzing week: ${weekStart.slice(0, 10)} → ${weekEnd.slice(0, 10)}.

FIXED EVENTS (cannot be moved):
${fixed.length ? fixed.map((e) => `• "${e.title}" ${fmt(e.startTime)} → ${fmt(e.endTime)}`).join("\n") : "  (none)"}

FLEXIBLE EVENTS (can be rescheduled to a better slot):
${flexible.length ? flexible.map((e) => `• [ID:${e.id}] "${e.title}" ${fmt(e.startTime)} → ${fmt(e.endTime)}`).join("\n") : "  (none)"}

UNSCHEDULED TASKS (need a slot this week):
${chips.length ? chips.map((c) => `• [ID:${c.id}] "${c.title}"${c.description ? ` — ${c.description}` : ""}`).join("\n") : "  (none)"}

Working hours: 07:00–23:00 UTC. Events must not overlap.
Suggest specific, actionable improvements. Use exact ISO 8601 datetimes (UTC).

Return ONLY valid JSON — no markdown, no explanation:
{
  "analysis": "2-3 sentences summarising the week and key opportunities",
  "suggestions": [
    {
      "type": "move_event",
      "eventId": "<exact id from above>",
      "eventTitle": "...",
      "currentStart": "ISO",
      "currentEnd": "ISO",
      "proposedStart": "ISO",
      "proposedEnd": "ISO",
      "reason": "..."
    },
    {
      "type": "schedule_chip",
      "chipId": "<exact id from above>",
      "chipTitle": "...",
      "proposedStart": "ISO",
      "proposedEnd": "ISO",
      "reason": "..."
    }
  ]
}`

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    })

    const text = response.content[0]?.type === "text" ? response.content[0].text.trim() : "{}"
    const match = text.match(/\{[\s\S]*\}/)
    const result = match
      ? (JSON.parse(match[0]) as { analysis: string; suggestions: Suggestion[] })
      : { analysis: "Could not generate suggestions.", suggestions: [] }

    return NextResponse.json(result)
  } catch (err) {
    console.error("Plando error:", err)
    return NextResponse.json({ error: "Optimization failed" }, { status: 500 })
  }
}
