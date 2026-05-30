"use client"

import { useState, useEffect } from "react"
import StyleTab from "@/components/events/EventForm/tabs/StyleTab"
import type { VisualStyle } from "@/types"

const LS_KEY = "plandoom_default_event_style"
const PREVIEW_PX = 128 // 2-hour representative event

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

export function loadDefaultEventStyle(): VisualStyle {
  if (typeof window === "undefined") return { ...FACTORY_DEFAULT }
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw) return { ...FACTORY_DEFAULT, ...(JSON.parse(raw) as Partial<VisualStyle>) }
  } catch { /* ignore */ }
  return { ...FACTORY_DEFAULT }
}

function saveStyle(vs: VisualStyle) {
  localStorage.setItem(LS_KEY, JSON.stringify(vs))
}

export default function DefaultSettingsTab() {
  const [vs, setVs] = useState<VisualStyle>(FACTORY_DEFAULT)

  useEffect(() => {
    setVs(loadDefaultEventStyle())
  }, [])

  function handleChange(patch: Partial<VisualStyle>) {
    setVs((prev) => {
      const next = { ...prev, ...patch }
      saveStyle(next)
      return next
    })
  }

  function handleReset() {
    saveStyle(FACTORY_DEFAULT)
    setVs({ ...FACTORY_DEFAULT })
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
        <button
          onClick={handleReset}
          className="text-[10px] text-smoke-500 hover:text-smoke-300 border border-smoke-700 hover:border-smoke-500 rounded px-2.5 py-1.5 transition-colors"
        >
          Reset to factory
        </button>
      </div>

      <StyleTab vs={vs} onChange={handleChange} durationPx={PREVIEW_PX} />
    </div>
  )
}
