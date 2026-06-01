import { NextResponse } from "next/server"
import { ensureUser } from "@/lib/auth"
import type { SeendoExtractedEvent } from "@/types"

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"

const VALID_MIME_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const
type ImageMimeType = (typeof VALID_MIME_TYPES)[number]

function buildPrompt(
  documentType: string,
  referenceText: string,
  timezone: string,
  furtherInstructions: string,
  referenceUnspecified: boolean
): string {
  const lines = [
    "You are an AI assistant specialized in reading agenda/planner images and extracting structured events.",
    `Document type: ${documentType || "agenda or planner"}`,
    referenceUnspecified
      ? "Reference period: not specified — use dates visible in the image"
      : `Reference period: ${referenceText}`,
    `Timezone: ${timezone || "UTC"}`,
    furtherInstructions ? `Additional instructions: ${furtherInstructions}` : null,
    "",
    "Extract ALL events, tasks, appointments, reminders, and notes visible in this image.",
    'Return ONLY a valid JSON array, no explanation, no markdown, no code blocks:',
    '[{"title":"...","description":"...or null","date":"YYYY-MM-DD or null","startTime":"HH:MM or null","endTime":"HH:MM or null"}]',
    "",
    "Rules:",
    "- Include every visible item, even if incomplete",
    "- Times must be in 24-hour format",
    "- For recurring events, include only what is written on the page",
    "- Do not invent information not visible in the image",
    "- If handwriting is unclear, use your best interpretation",
  ]
  return lines.filter((l) => l !== null).join("\n")
}

type GeminiCandidate = {
  content?: { parts?: Array<{ text?: string }> }
}
type GeminiResponse = {
  candidates?: GeminiCandidate[]
  error?: { code?: number; message?: string }
}

export async function POST(request: Request) {
  try {
    if (!GEMINI_API_KEY) {
      return NextResponse.json(
        {
          error:
            "Seendo non configurato: GEMINI_API_KEY mancante nelle variabili d'ambiente.",
        },
        { status: 503 }
      )
    }

    await ensureUser()

    const formData = await request.formData()
    const file = formData.get("image") as File | null
    if (!file) {
      return NextResponse.json({ error: "Nessuna immagine fornita" }, { status: 400 })
    }

    const referenceText = (formData.get("referenceText") as string | null) ?? ""
    const timezone = (formData.get("timezone") as string | null) ?? "UTC"
    const documentType = (formData.get("documentType") as string | null) ?? ""
    const furtherInstructions =
      (formData.get("furtherInstructions") as string | null) ?? ""
    const referenceUnspecified = formData.get("referenceUnspecified") === "true"

    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString("base64")
    const mimeType: ImageMimeType = VALID_MIME_TYPES.includes(
      file.type as ImageMimeType
    )
      ? (file.type as ImageMimeType)
      : "image/jpeg"

    const geminiRes = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { inline_data: { mime_type: mimeType, data: base64 } },
              {
                text: buildPrompt(
                  documentType,
                  referenceText,
                  timezone,
                  furtherInstructions,
                  referenceUnspecified
                ),
              },
            ],
          },
        ],
        generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
      }),
    })

    if (!geminiRes.ok) {
      if (geminiRes.status === 429) {
        return NextResponse.json(
          {
            error:
              "Budget token Seendo esaurito. Riprova il mese prossimo.",
            exhausted: true,
          },
          { status: 429 }
        )
      }
      const errBody = await geminiRes.text()
      console.error("Gemini API error:", geminiRes.status, errBody)
      return NextResponse.json(
        { error: "Analisi dell'immagine fallita" },
        { status: 502 }
      )
    }

    const geminiData = (await geminiRes.json()) as GeminiResponse
    const rawText =
      geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "[]"

    const match = rawText.match(/\[[\s\S]*\]/)
    const events: SeendoExtractedEvent[] = match
      ? (JSON.parse(match[0]) as SeendoExtractedEvent[])
      : []

    return NextResponse.json({ events })
  } catch (err) {
    console.error("Seendo error:", err)
    return NextResponse.json(
      { error: "Errore interno durante l'analisi" },
      { status: 500 }
    )
  }
}
