import { NextResponse } from "next/server"
import { anthropic } from "@/lib/anthropic"
import { ensureUser } from "@/lib/auth"

export async function POST(request: Request) {
  try {
    await ensureUser()

    const formData = await request.formData()
    const file = formData.get("image") as File | null
    if (!file) return NextResponse.json({ error: "No image provided" }, { status: 400 })

    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString("base64")
    const mediaType = (
      ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(file.type)
        ? file.type
        : "image/jpeg"
    ) as "image/jpeg" | "image/png" | "image/gif" | "image/webp"

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: base64 },
            },
            {
              type: "text",
              text: `You are an AI assistant that reads agenda/planner images and extracts structured events.

Carefully examine this image and extract ALL events, tasks, appointments, reminders, and notes you can see.

Return ONLY a valid JSON array — no explanation, no markdown, no extra text — in this exact format:
[
  {
    "title": "concise event or task title",
    "description": "additional details visible, or null",
    "date": "YYYY-MM-DD if a date is visible, otherwise null",
    "startTime": "HH:MM in 24h format if visible, otherwise null",
    "endTime": "HH:MM in 24h format if visible, otherwise null"
  }
]

Rules:
- If you cannot read text clearly, include it with your best guess
- Include every item you can see, even if incomplete
- For recurring events, include only what's written on the page
- Do not invent information not visible in the image`,
            },
          ],
        },
      ],
    })

    const text = response.content[0]?.type === "text" ? response.content[0].text.trim() : "[]"
    // Extract the JSON array even if there is surrounding text
    const match = text.match(/\[[\s\S]*\]/)
    const events = match ? (JSON.parse(match[0]) as unknown[]) : []

    return NextResponse.json({ events })
  } catch (err) {
    console.error("Seendo error:", err)
    return NextResponse.json({ error: "Failed to analyze image" }, { status: 500 })
  }
}
