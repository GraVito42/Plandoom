"use client"

import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import type { ApiFolder, RepetitionConfig } from "@/types"

const QUALITATIVE_OPTIONS = [
  { value: "morning", label: "Morning" },
  { value: "midday", label: "Midday" },
  { value: "afternoon", label: "Afternoon" },
  { value: "evening", label: "Evening" },
  { value: "night", label: "Night" },
]

const WEEK_DAYS = [
  { value: "mon", label: "M" },
  { value: "tue", label: "T" },
  { value: "wed", label: "W" },
  { value: "thu", label: "T" },
  { value: "fri", label: "F" },
  { value: "sat", label: "S" },
  { value: "sun", label: "S" },
]

export type ContentDraft = {
  title: string
  description: string
  startDate: string
  startTime: string
  endDate: string
  endTime: string
  isFullDay: boolean
  timezone: string
  qualitativeTiming: string
  location: string
  locationUrl: string
  repetition: RepetitionConfig | null
  folderId: string
}

interface ContentTabProps {
  draft: ContentDraft
  onChange: (patch: Partial<ContentDraft>) => void
}

function input(extra?: string) {
  return `bg-smoke-800 border border-smoke-700 text-smoke-100 text-sm rounded px-2 py-1.5 focus:outline-none focus:border-smoke-500 ${extra ?? ""}`
}

export default function ContentTab({ draft, onChange }: ContentTabProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [repetitionOpen, setRepetitionOpen] = useState(false)

  const { data: folders = [] } = useQuery<ApiFolder[]>({
    queryKey: ["folders"],
    queryFn: async () => {
      const res = await fetch("/api/folders")
      return res.json() as Promise<ApiFolder[]>
    },
  })

  function toggleRepDay(day: string) {
    const current = draft.repetition?.days ?? []
    const next = current.includes(day) ? current.filter((d) => d !== day) : [...current, day]
    onChange({ repetition: { ...draft.repetition!, days: next } })
  }

  const rep = draft.repetition

  return (
    <div className="flex flex-col gap-4 py-1">

      {/* Title */}
      <div>
        <label className="block text-[10px] text-smoke-500 uppercase tracking-wider mb-1">Title</label>
        <input
          type="text"
          value={draft.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="Event title"
          className={input("w-full")}
          autoFocus
        />
      </div>

      {/* Date & Time */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="text-smoke-500 text-xs">⏱</span>
          <div className="flex gap-1.5 flex-wrap">
            <input type="date" value={draft.startDate} onChange={(e) => onChange({ startDate: e.target.value })} className={input()} />
            {!draft.isFullDay && (
              <input type="time" value={draft.startTime} onChange={(e) => onChange({ startTime: e.target.value })} className={input()} />
            )}
            <span className="text-smoke-500 text-sm self-center">–</span>
            {!draft.isFullDay && (
              <input type="time" value={draft.endTime} onChange={(e) => onChange({ endTime: e.target.value })} className={input()} />
            )}
            <input type="date" value={draft.endDate} onChange={(e) => onChange({ endDate: e.target.value })} className={input()} />
          </div>
        </div>

        {/* Advanced settings toggle */}
        <button
          type="button"
          onClick={() => setAdvancedOpen((v) => !v)}
          className="flex items-center gap-1 text-[10px] text-smoke-500 hover:text-smoke-300 transition-colors w-fit"
        >
          <span>{advancedOpen ? "▾" : "▸"}</span>
          Advanced settings
        </button>

        {advancedOpen && (
          <div className="flex flex-col gap-3 pl-3 border-l border-smoke-700">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={draft.isFullDay}
                onChange={(e) => onChange({ isFullDay: e.target.checked })}
                className="accent-doom-gold"
              />
              <span className="text-xs text-smoke-300">Full day</span>
            </label>

            <div>
              <label className="block text-[10px] text-smoke-500 mb-1">Timezone</label>
              <input
                type="text"
                value={draft.timezone}
                onChange={(e) => onChange({ timezone: e.target.value })}
                placeholder="e.g. Europe/Rome"
                className={input("w-full")}
              />
            </div>

            <div>
              <label className="block text-[10px] text-smoke-500 mb-1.5">Qualitative timing</label>
              <div className="flex flex-wrap gap-2">
                {QUALITATIVE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onChange({ qualitativeTiming: draft.qualitativeTiming === opt.value ? "" : opt.value })}
                    className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                      draft.qualitativeTiming === opt.value
                        ? "bg-doom-gold text-navy-950 border-doom-gold"
                        : "bg-smoke-800 border-smoke-700 text-smoke-400 hover:text-smoke-200"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Location */}
      <div className="flex flex-col gap-2">
        <label className="block text-[10px] text-smoke-500 uppercase tracking-wider">
          📍 Location
        </label>
        <input
          type="text"
          value={draft.location}
          onChange={(e) => onChange({ location: e.target.value })}
          placeholder="Place or address"
          className={input("w-full")}
        />
        {draft.location && (
          <input
            type="url"
            value={draft.locationUrl}
            onChange={(e) => onChange({ locationUrl: e.target.value })}
            placeholder="Google Maps link (optional)"
            className={input("w-full text-xs")}
          />
        )}
      </div>

      {/* Notes */}
      <div>
        <label className="block text-[10px] text-smoke-500 uppercase tracking-wider mb-1">🗒 Notes</label>
        <textarea
          value={draft.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Notes…"
          rows={3}
          className={`${input("w-full resize-none")} leading-relaxed`}
        />
      </div>

      {/* Folder */}
      <div>
        <label className="block text-[10px] text-smoke-500 uppercase tracking-wider mb-1">📁 Folder</label>
        <select
          value={draft.folderId}
          onChange={(e) => onChange({ folderId: e.target.value })}
          className={input("w-full")}
        >
          <option value="">No folder</option>
          {folders.map((f) => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
      </div>

      {/* Repetition */}
      <div>
        <button
          type="button"
          onClick={() => {
            setRepetitionOpen((v) => !v)
            if (!draft.repetition) onChange({ repetition: { type: "weekly" } })
            else if (repetitionOpen) onChange({ repetition: null })
          }}
          className="flex items-center gap-1 text-[10px] text-smoke-500 hover:text-smoke-300 transition-colors"
        >
          <span>{repetitionOpen && rep ? "▾" : "▸"}</span>
          ⚙️ Repetition {rep ? <span className="text-doom-gold ml-1 capitalize">{rep.type}</span> : ""}
        </button>

        {repetitionOpen && rep && (
          <div className="flex flex-col gap-3 mt-3 pl-3 border-l border-smoke-700">
            {/* Type */}
            <div className="flex gap-1">
              {(["daily", "weekly", "monthly", "yearly"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => onChange({ repetition: { ...rep, type: t } })}
                  className={`flex-1 py-1 text-xs capitalize rounded border transition-colors ${
                    rep.type === t
                      ? "bg-doom-gold text-navy-950 border-doom-gold"
                      : "bg-smoke-800 border-smoke-700 text-smoke-400 hover:text-smoke-200"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Day selector for weekly */}
            {rep.type === "weekly" && (
              <div className="flex gap-1">
                {WEEK_DAYS.map((d) => (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => toggleRepDay(d.value)}
                    className={`w-7 h-7 text-xs rounded-full border transition-colors ${
                      rep.days?.includes(d.value)
                        ? "bg-doom-gold text-navy-950 border-doom-gold"
                        : "bg-smoke-800 border-smoke-700 text-smoke-400 hover:text-smoke-200"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            )}

            {/* End condition */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-[10px] text-smoke-500 mb-1">End date</label>
                <input
                  type="date"
                  value={rep.endDate ?? ""}
                  onChange={(e) => onChange({ repetition: { ...rep, endDate: e.target.value || undefined } })}
                  className={input("w-full")}
                />
              </div>
              <div className="w-24">
                <label className="block text-[10px] text-smoke-500 mb-1">Or # times</label>
                <input
                  type="number"
                  min={1}
                  value={rep.count ?? ""}
                  onChange={(e) => onChange({ repetition: { ...rep, count: e.target.value ? Number(e.target.value) : undefined } })}
                  className={input("w-full")}
                  placeholder="∞"
                />
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  )
}
