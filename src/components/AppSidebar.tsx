"use client"

import { useState } from "react"
import { ChevronRight } from "lucide-react"
import WeeklySidebar from "@/components/chips/WeeklySidebar"

const MIN_WIDTH = 180
const MAX_WIDTH = 480
const DEFAULT_WIDTH = 256

export default function AppSidebar() {
  const [open, setOpen] = useState(true)
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    if (typeof window === "undefined") return DEFAULT_WIDTH
    const saved = localStorage.getItem("plandoom_sidebar_width")
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH
  })

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startWidth = sidebarWidth

    const onMouseMove = (e: MouseEvent) => {
      const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + e.clientX - startX))
      setSidebarWidth(newWidth)
    }

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove)
      document.removeEventListener("mouseup", onMouseUp)
      setSidebarWidth((w) => {
        localStorage.setItem("plandoom_sidebar_width", String(w))
        return w
      })
    }

    document.addEventListener("mousemove", onMouseMove)
    document.addEventListener("mouseup", onMouseUp)
  }

  if (!open) {
    return (
      <aside className="w-8 shrink-0 bg-smoke-900 border-r border-smoke-800 flex items-start justify-center pt-3">
        <button
          onClick={() => setOpen(true)}
          className="text-smoke-500 hover:text-smoke-200 transition-colors"
          title="Show Weekly Notes"
        >
          <ChevronRight size={14} />
        </button>
      </aside>
    )
  }

  return (
    <aside
      className="shrink-0 bg-smoke-900 border-r border-smoke-800 flex flex-col overflow-hidden relative"
      style={{ width: sidebarWidth }}
    >
      <WeeklySidebar onCollapse={() => setOpen(false)} />
      <div
        className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-doom-gold/40 active:bg-doom-gold/70 transition-colors z-30"
        onMouseDown={handleMouseDown}
      />
    </aside>
  )
}
