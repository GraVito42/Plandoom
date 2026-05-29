"use client"

import { useState } from "react"
import { ChevronRight } from "lucide-react"
import WeeklySidebar from "@/components/chips/WeeklySidebar"

export default function AppSidebar() {
  const [open, setOpen] = useState(true)

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
    <aside className="w-52 shrink-0 bg-smoke-900 border-r border-smoke-800 flex flex-col overflow-hidden">
      <WeeklySidebar onCollapse={() => setOpen(false)} />
    </aside>
  )
}
