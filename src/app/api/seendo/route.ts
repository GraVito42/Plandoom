import { NextResponse } from "next/server"
import { ensureUser } from "@/lib/auth"
import { uploadToReading } from "@/lib/r2"
import { db } from "@/lib/db"
import { SEENDO_DAILY_LIMIT, SEENDO_DAILY_CALL_LIMIT, SEENDO_WINDOW_MS } from "@/lib/seendo-limits"
import type { SeendoExtractedEvent } from "@/types"

const GEMINI_API_KEY = process.env.GEMINI_API_KEY

const GEMINI_MODELS: Record<"low" | "medium" | "high", string> = {
  low:    "gemini-2.0-flash",
  medium: "gemini-2.0-flash",
  high:   "gemini-2.5-flash",
}

function getGeminiUrl(difficulty: string): string {
  const model = GEMINI_MODELS[difficulty as keyof typeof GEMINI_MODELS] ?? GEMINI_MODELS.high
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
}

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
    '[{"title":"...","description":"...or null","date":"YYYY-MM-DD or null","startTime":"HH:MM or null","endTime":"HH:MM or null","location":"venue or city if mentioned, otherwise null"}]',
    "",
    "Rules:",
    "- Include every visible item, even if incomplete",
    "- Times must be in 24-hour format",
    "- For recurring events, include only what is written on the page",
    "- Do not invent information not visible in the image",
    "- If handwriting is unclear, use your best interpretation",
    '- "location": extract venue name, room, or city if visible in the image; set to null if not mentioned',
  ]
  return lines.filter((l) => l !== null).join("\n")
}

type GeminiPart = {
  text?: string
  thought?: boolean  // Gemini 2.5 Flash include parti "thinking" con thought: true
}
type GeminiCandidate = {
  content?: { parts?: GeminiPart[] }
  finishReason?: string
}
type GeminiResponse = {
  candidates?: GeminiCandidate[]
  error?: { code?: number; message?: string }
  usageMetadata?: {
    promptTokenCount?: number
    candidatesTokenCount?: number
    totalTokenCount?: number
  }
}

// Estrae il primo array JSON completo con depth tracking, evitando il
// problema della regex greedy `\[[\s\S]*\]` che cattura fino all'ultimo `]`
// anche se fa parte di testo fuori dall'array.
function extractFirstJsonArray(text: string): string | null {
  const start = text.indexOf("[")
  if (start === -1) return null
  let depth = 0
  let inString = false
  let prevBackslash = false
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (inString) {
      if (prevBackslash) { prevBackslash = false; continue }
      if (ch === "\\") { prevBackslash = true; continue }
      if (ch === '"') inString = false
      continue
    }
    prevBackslash = false
    if (ch === '"') { inString = true; continue }
    if (ch === "[") depth++
    else if (ch === "]") {
      depth--
      if (depth === 0) return text.slice(start, i + 1)
    }
  }
  return null
}

// Tenta di estrarre un array di eventi dalla risposta grezza di Gemini.
// Gestisce sia array diretti `[...]` che wrapper tipo `{"events": [...]}`,
// code block markdown ovunque nel testo, e testo extra prima/dopo l'array.
function parseGeminiRawText(raw: string): SeendoExtractedEvent[] | null {
  // Rimuove i markdown code fences ovunque (non solo inizio/fine)
  const cleaned = raw
    .replace(/```[\w]*\n?/g, "")
    .replace(/```/g, "")
    .trim()

  console.log("[Seendo] Testo pulito per parsing (primi 300 car):", cleaned.slice(0, 300))

  // Tentativo 1: parse JSON diretto — array o oggetto wrapper
  try {
    const parsed: unknown = JSON.parse(cleaned)
    if (Array.isArray(parsed)) return parsed as SeendoExtractedEvent[]
    if (typeof parsed === "object" && parsed !== null) {
      for (const val of Object.values(parsed as Record<string, unknown>)) {
        if (Array.isArray(val)) return val as SeendoExtractedEvent[]
      }
    }
  } catch {
    // parse diretto fallito — si prova con estrazione depth-aware
  }

  // Tentativo 2: depth tracking per trovare il primo array JSON completo,
  // evitando la regex greedy che catturava troppo in presenza di testo dopo l'array
  const arrayStr = extractFirstJsonArray(cleaned)
  if (!arrayStr) return null

  try {
    const parsed: unknown = JSON.parse(arrayStr)
    return Array.isArray(parsed) ? (parsed as SeendoExtractedEvent[]) : null
  } catch {
    return null
  }
}

// Verifica che le variabili R2 necessarie siano configurate
function checkR2Config(): string | null {
  const missing = [
    "CLOUDFLARE_R2_ACCOUNT_ID",
    "CLOUDFLARE_R2_ACCESS_KEY_ID",
    "CLOUDFLARE_R2_SECRET_ACCESS_KEY",
    "CLOUDFLARE_R2_READING_BUCKET",
    "CLOUDFLARE_R2_READING_PUBLIC_URL",
  ].filter((k) => !process.env[k])
  if (missing.length > 0) return `Missing R2 environment variables: ${missing.join(", ")}`
  return null
}

export async function POST(request: Request) {
  try {
    if (!GEMINI_API_KEY) {
      console.error("[Seendo] GEMINI_API_KEY not configured")
      return NextResponse.json(
        { error: "Gemini API key not configured. Contact the administrator." },
        { status: 503 }
      )
    }

    const r2Error = checkR2Config()
    if (r2Error) {
      console.error("[Seendo] R2 config error:", r2Error)
      return NextResponse.json(
        { error: `Storage not configured: ${r2Error}` },
        { status: 503 }
      )
    }

    const user = await ensureUser()

    // Lettura e reset automatico finestra rolling 24h
    const now = new Date()
    const dbUser = await db.user.findUnique({
      where: { id: user.id },
      select: { seendoTokensUsed: true, seendoTokensResetAt: true, seendoMonthYear: true, seendoCallsToday: true, role: true },
    })
    let currentTokens = dbUser?.seendoTokensUsed ?? 0
    let currentCalls = dbUser?.seendoCallsToday ?? 0
    const tokenResetAt = dbUser?.seendoTokensResetAt ?? null

    if (!tokenResetAt || now.getTime() - tokenResetAt.getTime() > SEENDO_WINDOW_MS) {
      await db.user.update({
        where: { id: user.id },
        data: { seendoTokensUsed: 0, seendoTokensResetAt: now, seendoCallsToday: 0 },
      })
      currentTokens = 0
      currentCalls = 0
    }

    if (currentTokens >= SEENDO_DAILY_LIMIT) {
      return NextResponse.json(
        { error: "Seendo daily token budget exhausted. Try again tomorrow.", exhausted: true },
        { status: 429 }
      )
    }

    if (dbUser?.role !== "admin" && currentCalls >= SEENDO_DAILY_CALL_LIMIT) {
      return NextResponse.json(
        {
          error: `Daily Seendo call limit reached (${SEENDO_DAILY_CALL_LIMIT}/${SEENDO_DAILY_CALL_LIMIT}). Try again tomorrow.`,
          callLimitReached: true,
        },
        { status: 429 }
      )
    }

    const formData = await request.formData()
    const file = formData.get("image") as File | null

    // Log per debug: verifica che il file arrivi correttamente
    console.log("[Seendo] Received file:", file?.name, file?.type, file?.size)

    if (!file || file.size === 0) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 })
    }

    const referenceText = (formData.get("referenceText") as string | null) ?? ""
    const timezone = (formData.get("timezone") as string | null) ?? "UTC"
    const documentType = (formData.get("documentType") as string | null) ?? ""
    const furtherInstructions =
      (formData.get("furtherInstructions") as string | null) ?? ""
    const referenceUnspecified = formData.get("referenceUnspecified") === "true"
    const difficulty = (formData.get("difficulty") as string | null) ?? "high"

    const geminiUrl = getGeminiUrl(difficulty)
    console.log("[Seendo] difficulty:", difficulty, "→ model:", geminiUrl.match(/models\/([^:]+)/)?.[1])

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const base64 = buffer.toString("base64")
    const mimeType: ImageMimeType = VALID_MIME_TYPES.includes(
      file.type as ImageMimeType
    )
      ? (file.type as ImageMimeType)
      : "image/jpeg"

    // Carica l'immagine su R2 prima di chiamare Gemini
    let imageUrl: string
    let imageSizeBytes = 0
    try {
      const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
      const r2Key = `uploads/${user.id}/${Date.now()}-${safeFilename}`
      const { url, sizeBytes } = await uploadToReading(buffer, r2Key, mimeType)
      imageUrl = url
      imageSizeBytes = sizeBytes
      console.log("[Seendo] Image uploaded to R2:", imageUrl)
    } catch (r2Err) {
      console.error("[Seendo] R2 upload failed:", r2Err)
      return NextResponse.json(
        { error: "Failed to upload image to storage. Check R2 credentials." },
        { status: 502 }
      )
    }

    // Traccia spazio R2 consumato dall'immagine OCR (anche se Gemini fallisse)
    await db.user.update({
      where: { id: user.id },
      data: { seendoStorageBytes: { increment: imageSizeBytes } },
    })

    const geminiRes = await fetch(`${geminiUrl}?key=${GEMINI_API_KEY}`, {
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
        generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
      }),
    })

    if (!geminiRes.ok) {
      if (geminiRes.status === 429) {
        return NextResponse.json(
          {
            error: "Seendo monthly budget exhausted. Please try again next month.",
            exhausted: true,
          },
          { status: 429 }
        )
      }
      const errBody = await geminiRes.text()
      console.error("[Seendo] Gemini API error:", geminiRes.status, errBody)
      return NextResponse.json(
        { error: "Image analysis failed. Gemini API returned an error." },
        { status: 502 }
      )
    }

    const geminiData = (await geminiRes.json()) as GeminiResponse
    const candidate = geminiData.candidates?.[0]
    const parts = candidate?.content?.parts ?? []

    console.log("[Seendo] finishReason:", candidate?.finishReason, "| parts:", parts.length)

    // Se Gemini ha troncato per limite token, il JSON sarebbe incompleto
    if (candidate?.finishReason === "MAX_TOKENS") {
      console.error("[Seendo] Risposta troncata per MAX_TOKENS — aumentare maxOutputTokens o ridurre l'immagine")
      return NextResponse.json(
        { error: "The image contains too many events to process at once. Try cropping it into smaller sections." },
        { status: 422 }
      )
    }

    // Gemini 2.5 Flash può restituire parti "thinking" (thought: true) prima del testo
    // effettivo; si prende l'ultima parte non-thinking che contenga testo
    const responsePart =
      [...parts].reverse().find((p) => !p.thought && typeof p.text === "string") ??
      parts.at(-1)
    const rawText = responsePart?.text?.trim() ?? "[]"

    console.log("[Seendo] rawText (primi 200 car):", rawText.slice(0, 200))

    const events = parseGeminiRawText(rawText)
    if (!events) {
      console.error("[Seendo] Could not parse JSON from Gemini response:", rawText)
      return NextResponse.json(
        { error: "Could not parse events from image. The model returned an unexpected format." },
        { status: 422 }
      )
    }

    // Accumulo token Gemini — finestra giornaliera + contatore mensile
    const tokensConsumed = geminiData.usageMetadata?.totalTokenCount ?? 0
    const currentMonthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
    const isSameMonth = dbUser?.seendoMonthYear === currentMonthYear
    await db.user.update({
      where: { id: user.id },
      data: {
        seendoCallsToday: { increment: 1 },
        ...(tokensConsumed > 0 ? {
          seendoTokensUsed: { increment: tokensConsumed },
          seendoTokensMonthly: isSameMonth ? { increment: tokensConsumed } : tokensConsumed,
          seendoMonthYear: currentMonthYear,
        } : {}),
      },
    })

    if (tokensConsumed > 0) {
      await db.seendoTokenLog.create({
        data: {
          userId: user.id,
          tokens: tokensConsumed,
          model: GEMINI_MODELS[difficulty as keyof typeof GEMINI_MODELS] ?? GEMINI_MODELS.high,
        },
      })
    }

    return NextResponse.json({ events, imageUrl, imageSizeBytes })
  } catch (err) {
    console.error("[Seendo] Unexpected error:", err)
    return NextResponse.json(
      { error: "An error occurred during analysis. Please try again." },
      { status: 500 }
    )
  }
}
