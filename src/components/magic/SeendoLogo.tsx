"use client"

import { useQuery } from "@tanstack/react-query"
import { getSeendoBudgetStatus } from "@/lib/seendo-budget"
import type { SeendoBudgetStatus, ApiMe } from "@/types"

const SIZE_PX = { sm: 16, md: 40, lg: 72, xl: 96 } as const

const EYE_FILL: Record<SeendoBudgetStatus, string> = {
  active:         "#4ade80",  // verde
  restricted:     "#f59e0b",  // amber — budget quasi esaurito
  exhausted:      "#ef4444",  // rosso
  call_exhausted: "#ef4444",  // rosso — limite chiamate raggiunto
}
const EYE_FILL_ADMIN = "#7c3aed"  // viola — doom-rune

interface SeendoLogoProps {
  // Accetta sia chiavi nominali che pixel numerici (es. 20 per i pulsanti Golem)
  size?: keyof typeof SIZE_PX | number
  // Override per il pannello debug admin — bypassa le query interne
  debugStatus?: SeendoBudgetStatus | "admin"
}

export default function SeendoLogo({ size = "md", debugStatus }: SeendoLogoProps) {
  const px: number = typeof size === "number" ? size : SIZE_PX[size as keyof typeof SIZE_PX]

  const { data: budgetStatus = "active" } = useQuery<SeendoBudgetStatus>({
    queryKey: ["seendo-budget"],
    queryFn: () => getSeendoBudgetStatus(""),
    staleTime: 5 * 60 * 1000,
  })

  const { data: me } = useQuery<ApiMe>({
    queryKey: ["me"],
    queryFn: () => fetch("/api/me").then((r) => r.json() as Promise<ApiMe>),
    staleTime: 5 * 60 * 1000,
  })

  // debugStatus ha priorità sulle query quando presente
  const eyeColor: string = debugStatus !== undefined
    ? (debugStatus === "admin" ? EYE_FILL_ADMIN : EYE_FILL[debugStatus])
    : (me?.role === "admin" ? EYE_FILL_ADMIN : EYE_FILL[budgetStatus])

  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 400 400"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Seendo"
      style={{ display: "block" }}
    >
      {/* Triangolo — stroke doom-gold, fill navy scuro */}
      <polygon
        points="50,300 350,300 200,40"
        stroke="#c9a84c"
        strokeWidth="12"
        strokeLinejoin="round"
        fill="rgba(10,22,40,0.9)"
      />
      {/* Occhio a lente (due archi) — fill = stato token / admin */}
      <path
        d="M 125,170 A 94 94 0 0 1 275,170 A 75 75 0 0 1 125,170 Z"
        fill={eyeColor}
        fillOpacity="0.9"
        stroke="#c9a84c"
        strokeWidth="6"
      />
    </svg>
  )
}
