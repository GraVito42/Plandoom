"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useRef, useCallback } from "react"
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
    <div
      className={`bg-navy-900 border border-smoke-700 rounded-lg p-2 mb-3 transition-all ${
        hasContent ? "max-h-[240px] overflow-y-auto" : "min-h-[48px]"
      }`}
    >
      {hasContent ? (
        <RichTextEditor
          content={data?.content ?? null}
          onChange={handleChange}
          placeholder="Note settimanali..."
        />
      ) : (
        <RichTextEditor
          content={null}
          onChange={handleChange}
          placeholder="Note settimanali..."
          className="min-h-[32px]"
        />
      )}
    </div>
  )
}
