"use client"

import { useEffect } from "react"

export default function FontInitializer() {
  useEffect(() => {
    try {
      const f = localStorage.getItem("plandoom_default_font")
      if (f && f !== "inherit") document.documentElement.style.fontFamily = f
    } catch { /* ignore */ }
  }, [])
  return null
}
