"use client"

import { useState, useEffect, useRef } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import StyleTab from "@/components/events/EventForm/tabs/StyleTab"
import type { VisualStyle, ApiMe } from "@/types"

const LS_KEY = "plandoom_default_event_style"
const PREVIEW_PX = 128 // rappresenta un evento da 2 ore

const FACTORY_DEFAULT: VisualStyle = {
  shape: "rounded",
  frameColor: "transparent",
  frameWidth: 1,
  sideColor: "#c9a84c",
  sideWidth: 2,
  fillColor: "#162d5e",
  fillOpacity: 100,
  textColor: "#d1d5db",
  fontFamily: "inherit",
  hasCheckbox: false,
  isChecked: false,
  eventType: "default",
  shapePath: null,
  shapeSmoothing: 0,
  textPosition: null,
  widthPercent: 100,
  leftOffset: 0,
}

// Esportata: usata come fallback sincrono nei componenti che non possono attendere il server
export function loadDefaultEventStyle(): VisualStyle {
  if (typeof window === "undefined") return { ...FACTORY_DEFAULT }
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) return { ...FACTORY_DEFAULT, ...(JSON.parse(raw) as Partial<VisualStyle>) }
  } catch { /* ignore */ }
  return { ...FACTORY_DEFAULT }
}

function saveToLocalStorage(vs: VisualStyle) {
  localStorage.setItem(LS_KEY, JSON.stringify(vs))
}

async function patchDefaultStyle(vs: VisualStyle | null): Promise<ApiMe> {
  const res = await fetch("/api/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ defaultVisualStyle: vs }),
  })
  if (!res.ok) throw new Error("Failed to save default style")
  return res.json() as Promise<ApiMe>
}

export default function DefaultSettingsTab() {
  const queryClient = useQueryClient()

  const [vs, setVs] = useState<VisualStyle>({ ...FACTORY_DEFAULT })

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY)
      if (raw) setVs({ ...FACTORY_DEFAULT, ...(JSON.parse(raw) as Partial<VisualStyle>) })
    } catch { /* ignore */ }
  }, [])

  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle")

  // Evita di sovrascrivere le modifiche in corso se il server risponde in ritardo
  const userHasEdited = useRef(false)
  // Applica il valore del server una sola volta per montaggio
  const serverValueApplied = useRef(false)
  // Debounce: ultimo valore in attesa di essere inviato al server
  const pendingStyleRef = useRef<VisualStyle | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const { data: me } = useQuery<ApiMe>({
    queryKey: ["me"],
    queryFn: () => fetch("/api/me").then((r) => r.json() as Promise<ApiMe>),
    staleTime: 5 * 60 * 1000,
  })

  // Sincronizza con il DB al primo caricamento (cross-device sync)
  useEffect(() => {
    if (serverValueApplied.current || userHasEdited.current || !me) return
    serverValueApplied.current = true
    if (me.defaultVisualStyle) {
      // Server ha un valore → sincronizza localStorage dal server
      const serverStyle: VisualStyle = { ...FACTORY_DEFAULT, ...(me.defaultVisualStyle as Partial<VisualStyle>) }
      setVs(serverStyle)
      saveToLocalStorage(serverStyle)
    } else {
      // Server è null → push del valore localStorage per allineare il DB
      saveToServer(vs)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me])

  // Cleanup del timer di debounce al dismount
  useEffect(() => () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
  }, [])

  const { mutate: saveToServer } = useMutation({
    mutationFn: patchDefaultStyle,
    onMutate: () => setSaveStatus("saving"),
    onSuccess: (updated) => {
      queryClient.setQueryData<ApiMe>(["me"], updated)
      setSaveStatus("saved")
      setTimeout(() => setSaveStatus("idle"), 2000)
    },
    onError: () => setSaveStatus("error"),
  })

  function handleChange(patch: Partial<VisualStyle>) {
    userHasEdited.current = true
    setVs((prev) => {
      const next = { ...prev, ...patch }
      pendingStyleRef.current = next
      saveToLocalStorage(next)
      return next
    })
    // Debounce: evita una PATCH per ogni tick di slider; invia solo dopo 400ms di inattività
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      if (pendingStyleRef.current) saveToServer(pendingStyleRef.current)
    }, 400)
  }

  function handleReset() {
    userHasEdited.current = true
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    const reset = { ...FACTORY_DEFAULT }
    saveToLocalStorage(reset)
    saveToServer(reset)
    setVs(reset)
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-smoke-100">Default Event Style</h2>
          <p className="text-[10px] text-smoke-500 mt-0.5">
            Applied to new events that have no folder or custom style
          </p>
        </div>
        <div className="flex items-center gap-3">
          {saveStatus !== "idle" && (
            <span className={`text-[10px] transition-opacity ${
              saveStatus === "saving" ? "text-smoke-500" :
              saveStatus === "saved"  ? "text-doom-gold" :
              "text-doom-ember"
            }`}>
              {saveStatus === "saving" ? "Saving…" :
               saveStatus === "saved"  ? "Saved ✓" :
               "Save failed"}
            </span>
          )}
          <button
            onClick={handleReset}
            className="text-[10px] text-smoke-500 hover:text-smoke-300 border border-smoke-700 hover:border-smoke-500 rounded px-2.5 py-1.5 transition-colors"
          >
            Reset to factory
          </button>
        </div>
      </div>

      <StyleTab vs={vs} onChange={handleChange} durationPx={PREVIEW_PX} />
    </div>
  )
}
