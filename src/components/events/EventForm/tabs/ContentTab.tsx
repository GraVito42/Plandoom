"use client"

import { useState, useEffect, useRef } from "react"
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

type PlaceResult = {
  name: string
  fullAddress: string
  mapsUrl: string
}

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
  onFolderChange?: (folderId: string, folderVisualStyle: unknown) => void
}

function input(extra?: string) {
  return `bg-smoke-800 border border-smoke-700 text-smoke-100 text-sm rounded px-2 py-1.5 focus:outline-none focus:border-smoke-500 ${extra ?? ""}`
}

// ── MapPinIcon ────────────────────────────────────────────────────────────────
function MapPinIcon({ className }: { className?: string }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z" />
    </svg>
  )
}

// ── LocationField ─────────────────────────────────────────────────────────────
function LocationField({
  location,
  locationUrl,
  onChange,
}: {
  location: string
  locationUrl: string
  onChange: (patch: { location?: string; locationUrl?: string }) => void
}) {
  const [searchOpen, setSearchOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<PlaceResult[]>([])
  const [loading, setLoading] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults([])
      return
    }
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/maps/places?q=${encodeURIComponent(query)}`)
        if (res.ok) setResults((await res.json()) as PlaceResult[])
      } finally {
        setLoading(false)
      }
    }, 350)
    return () => clearTimeout(timer)
  }, [query])

  function openSearch() {
    setSearchOpen(true)
    setTimeout(() => searchInputRef.current?.focus(), 30)
  }

  function closeSearch() {
    setSearchOpen(false)
    setQuery("")
    setResults([])
  }

  function selectPlace(place: PlaceResult) {
    onChange({ location: place.name, locationUrl: place.mapsUrl })
    closeSearch()
  }

  return (
    <div className="flex flex-col gap-1.5">
      {/* Location input row */}
      <div className="flex gap-1">
        <input
          type="text"
          value={location}
          onChange={(e) => onChange({ location: e.target.value })}
          placeholder="Place or address"
          className={input("flex-1")}
        />
        <button
          type="button"
          onClick={searchOpen ? closeSearch : openSearch}
          title="Search on Maps"
          className={`flex items-center justify-center w-8 rounded border transition-colors shrink-0 ${
            searchOpen
              ? "bg-doom-gold/15 border-doom-gold/50 text-doom-gold"
              : "border-smoke-700 text-smoke-400 hover:text-smoke-200 hover:border-smoke-500 bg-smoke-800"
          }`}
        >
          <MapPinIcon />
        </button>
      </div>

      {/* Inline search box */}
      {searchOpen && (
        <div className="flex flex-col gap-1">
          <div className="flex gap-1">
            <input
              ref={searchInputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Escape") closeSearch() }}
              placeholder="Search places…"
              className={input("flex-1 text-xs")}
            />
            <button
              type="button"
              onClick={closeSearch}
              className="text-smoke-400 hover:text-smoke-200 px-2 text-sm transition-colors"
            >
              ✕
            </button>
          </div>

          {loading && (
            <p className="text-[10px] text-smoke-500 px-1">Searching…</p>
          )}

          {results.length > 0 && (
            <div className="flex flex-col bg-smoke-800 border border-smoke-700 rounded-lg overflow-hidden shadow-lg">
              {results.map((place, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => selectPlace(place)}
                  className="flex flex-col items-start px-3 py-2 text-left hover:bg-smoke-700 transition-colors border-b border-smoke-700/50 last:border-0"
                >
                  <span className="text-xs text-smoke-100 font-medium leading-snug">{place.name}</span>
                  <span className="text-[10px] text-smoke-400 truncate w-full">{place.fullAddress}</span>
                </button>
              ))}
            </div>
          )}

          {!loading && query.length >= 2 && results.length === 0 && (
            <p className="text-[10px] text-smoke-600 px-1">No results found</p>
          )}
        </div>
      )}

      {/* Maps link or manual URL input */}
      {!searchOpen && locationUrl && (
        <a
          href={locationUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-doom-gold/70 hover:text-doom-gold transition-colors self-start"
        >
          Open in Maps →
        </a>
      )}
      {!searchOpen && location && !locationUrl && (
        <input
          type="url"
          value={locationUrl}
          onChange={(e) => onChange({ locationUrl: e.target.value })}
          placeholder="Google Maps link (optional)"
          className={input("w-full text-xs")}
        />
      )}
    </div>
  )
}

// ── ContentTab ────────────────────────────────────────────────────────────────
export default function ContentTab({ draft, onChange, onFolderChange }: ContentTabProps) {
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
      <div>
        <label className="block text-[10px] text-smoke-500 uppercase tracking-wider mb-1.5">
          📍 Location
        </label>
        <LocationField
          location={draft.location}
          locationUrl={draft.locationUrl}
          onChange={onChange}
        />
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
          onChange={(e) => {
            const newId = e.target.value
            onChange({ folderId: newId })
            const folder = folders.find((f) => f.id === newId)
            onFolderChange?.(newId, folder?.visualStyle ?? null)
          }}
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
