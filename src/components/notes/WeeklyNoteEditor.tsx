"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useRef, useCallback, useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import RichTextEditor from "@/components/ui/RichTextEditor"

interface WeeklyNoteEditorProps {
  weekStart: Date
}

interface WeeklyNoteResponse {
  content: string | null
}

export default function WeeklyNoteEditor({ weekStart }: WeeklyNoteEditorProps) {
  const weekStartISO = weekStart.toISOString()
  const queryClient = useQueryClient()
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isVisible, setIsVisible] = useState(true)

  const { data } = useQuery<WeeklyNoteResponse>({
    queryKey: ["weeklyNote", weekStartISO],
    queryFn: async () => {
      const res = await fetch(`/api/notes/weekly?weekStart=${encodeURIComponent(weekStartISO)}`)
      if (!res.ok) throw new Error("Failed to load weekly note")
      return res.json() as Promise<WeeklyNoteResponse>
    },
  })

  const handleChange = useCallback(
    (html: string) => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
      debounceTimer.current = setTimeout(async () => {
        await fetch(`/api/notes/weekly?weekStart=${encodeURIComponent(weekStartISO)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: html }),
        })
        await queryClient.invalidateQueries({ queryKey: ["weeklyNote", weekStartISO] })
      }, 500)
    },
    [weekStartISO, queryClient]
  )

  const hasContent = !!(data?.content && data.content.replace(/<[^>]*>/g, "").trim())

  return (
    <div className="bg-navy-900 border border-smoke-700 rounded-lg mb-3 overflow-hidden transition-all">
      {/* Header barra con toggle */}
      <div className="flex items-center justify-between px-2 py-1.5 border-b border-smoke-700/60">
        <span className="text-[10px] font-semibold text-smoke-500 uppercase tracking-widest">
          Weekly notes
        </span>
        <button
          type="button"
          onClick={() => setIsVisible((v) => !v)}
          className="text-smoke-400 hover:text-smoke-200 transition-colors"
          title={isVisible ? "Collapse" : "Expand"}
        >
          {isVisible ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      </div>

      {/* Editor area — visibile solo se isVisible=true */}
      {isVisible && (
        <div
          className={`p-2 ${hasContent ? "max-h-[240px] overflow-y-auto" : "min-h-[48px]"}`}
        >
          <RichTextEditor
            content={data?.content ?? null}
            onChange={handleChange}
            placeholder="Weekly notes..."
          />
        </div>
      )}
    </div>
  )
}
