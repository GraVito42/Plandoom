export type GoogleTokens = {
  access_token: string
  refresh_token: string
  token_type: string
  expiry_date: number
}

const TOKEN_URL = "https://oauth2.googleapis.com/token"
const GCAL = "https://www.googleapis.com/calendar/v3"

export function buildAuthUrl(origin: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: `${origin}/api/glando/callback`,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/calendar",
    access_type: "offline",
    prompt: "consent",
    state,
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`
}

export async function exchangeCode(code: string, origin: string): Promise<GoogleTokens> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: `${origin}/api/glando/callback`,
      grant_type: "authorization_code",
    }),
  })
  const data = await res.json() as { access_token: string; refresh_token: string; token_type: string; expires_in: number }
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    token_type: data.token_type,
    expiry_date: Date.now() + (data.expires_in ?? 3600) * 1000,
  }
}

export async function refreshTokens(tokens: GoogleTokens): Promise<GoogleTokens> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      refresh_token: tokens.refresh_token,
      grant_type: "refresh_token",
    }),
  })
  const data = await res.json() as { access_token?: string; expires_in?: number }
  return {
    ...tokens,
    access_token: data.access_token ?? tokens.access_token,
    expiry_date: Date.now() + (data.expires_in ?? 3600) * 1000,
  }
}

export async function getValidTokens(tokens: GoogleTokens): Promise<GoogleTokens> {
  if (Date.now() < tokens.expiry_date - 60_000) return tokens
  return refreshTokens(tokens)
}

async function gcalFetch(method: string, path: string, tokens: GoogleTokens, body?: unknown) {
  return fetch(`${GCAL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${tokens.access_token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
}

export async function gcalGet<T>(path: string, tokens: GoogleTokens): Promise<T> {
  const res = await gcalFetch("GET", path, tokens)
  return res.json() as Promise<T>
}

export async function gcalPost<T>(path: string, body: unknown, tokens: GoogleTokens): Promise<T> {
  const res = await gcalFetch("POST", path, tokens, body)
  return res.json() as Promise<T>
}

export async function gcalPut<T>(path: string, body: unknown, tokens: GoogleTokens): Promise<T> {
  const res = await gcalFetch("PUT", path, tokens, body)
  return res.json() as Promise<T>
}

export async function gcalDelete(path: string, tokens: GoogleTokens): Promise<void> {
  await gcalFetch("DELETE", path, tokens)
}
