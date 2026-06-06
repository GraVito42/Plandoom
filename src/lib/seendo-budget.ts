import type { SeendoBudgetStatus } from "@/types"

// Stima display-only: +24h dall'ora attuale. Il valore reale viene da /api/seendo/budget.
export function getSeendoResetDate(): Date {
  return new Date(Date.now() + 24 * 60 * 60 * 1000)
}

// Client-safe: chiama l'endpoint autenticato.
// Usata da Seendo.tsx e SeendoLogo.tsx come queryFn di TanStack Query.
export async function getSeendoBudgetStatus(
  _userId: string
): Promise<SeendoBudgetStatus> {
  const res = await fetch("/api/seendo/budget")
  if (!res.ok) return "active"
  const data = (await res.json()) as { status: SeendoBudgetStatus }
  return data.status
}
