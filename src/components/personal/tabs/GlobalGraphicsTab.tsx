"use client"

import { useState, useEffect } from "react"

const FONT_LS_KEY = "plandoom_default_font"

const FONTS = [
  { label: "Default (Geist)", value: "inherit" },
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Calibri", value: "Calibri, Candara, sans-serif" },
  { label: "Roboto", value: "Roboto, sans-serif" },
  { label: "Serif", value: "Georgia, serif" },
  { label: "Mono", value: "ui-monospace, monospace" },
]

export default function GlobalGraphicsTab() {
  const [font, setFont] = useState("inherit")

  useEffect(() => {
    const savedFont = localStorage.getItem(FONT_LS_KEY)
    if (savedFont) setFont(savedFont)
  }, [])

  function handleFontChange(value: string) {
    setFont(value)
    localStorage.setItem(FONT_LS_KEY, value)
    if (value === "inherit") {
      document.documentElement.style.removeProperty("font-family")
    } else {
      document.documentElement.style.fontFamily = value
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-sm font-semibold text-smoke-100">Global Graphics</h2>
        <p className="text-[10px] text-smoke-500 mt-0.5">App-wide visual settings</p>
      </div>

      {/* App font */}
      <div className="flex flex-col gap-2">
        <label className="text-[10px] text-smoke-500 uppercase tracking-wider">App Font</label>
        <select
          value={font}
          onChange={(e) => handleFontChange(e.target.value)}
          className="bg-smoke-800 border border-smoke-600 rounded px-2.5 py-1.5 text-xs text-smoke-100 focus:outline-none focus:border-doom-gold/50"
        >
          {FONTS.map((f) => (
            <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>
              {f.label}
            </option>
          ))}
        </select>
        <p className="text-[10px] text-smoke-600">Applied immediately — persists across sessions</p>
      </div>

      {/* Theme — disabled until light mode is designed */}
      <div className="flex flex-col gap-2">
        <label className="text-[10px] text-smoke-500 uppercase tracking-wider">Theme</label>
        <div className="flex items-center justify-between p-3 rounded-lg border border-smoke-700 bg-smoke-900/40 opacity-60 cursor-not-allowed">
          <div>
            <p className="text-xs text-smoke-300">Dark mode</p>
            <p className="text-[10px] text-smoke-600 mt-0.5">Light mode coming in a future update</p>
          </div>
          {/* Fake toggle — always dark */}
          <div className="w-9 h-5 rounded-full bg-doom-gold/40 relative shrink-0">
            <div className="absolute right-0.5 top-0.5 w-4 h-4 rounded-full bg-doom-gold" />
          </div>
        </div>
      </div>
    </div>
  )
}
