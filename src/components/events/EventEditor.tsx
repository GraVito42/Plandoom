"use client"

import { useState } from "react"
import type { ApiEvent } from "@/types"

interface EventEditorProps {
  date: Date | null
  startHour: number | null
  eventToEdit: ApiEvent | null
  onSave: () => Promise<void>
  onDelete: (id: string) => Promise<void>
  onClose: () => void
}

function toLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function toLocalTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
}

export default function EventEditor({
  date,
  startHour,
  eventToEdit,
  onSave,
  onDelete,
  onClose,
}: EventEditorProps) {
  const isEdit = !!eventToEdit

  const defaultDate = eventToEdit
    ? toLocalDate(new Date(eventToEdit.startTime))
    : date
    ? toLocalDate(date)
    : toLocalDate(new Date())

  const defaultStart = eventToEdit
    ? toLocalTime(new Date(eventToEdit.startTime))
    : startHour !== null
    ? `${String(startHour).padStart(2, "0")}:00`
    : "09:00"

  const defaultEnd = eventToEdit
    ? toLocalTime(new Date(eventToEdit.endTime))
    : startHour !== null
    ? `${String(Math.min(startHour + 1, 23)).padStart(2, "0")}:00`
    : "10:00"

  const [title, setTitle] = useState(eventToEdit?.title ?? "")
  const [description, setDescription] = useState(eventToEdit?.description ?? "")
  const [eventDate, setEventDate] = useState(defaultDate)
  const [startTime, setStartTime] = useState(defaultStart)
  const [endTime, setEndTime] = useState(defaultEnd)
  const [flexible, setFlexible] = useState(eventToEdit?.isFlexible ?? false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return

    setLoading(true)
    try {
      const start = new Date(`${eventDate}T${startTime}`).toISOString()
      const end = new Date(`${eventDate}T${endTime}`).toISOString()

      const body = {
        title: title.trim(),
        description: description.trim() || undefined,
        startTime: start,
        endTime: end,
        isFlexible: flexible,
      }

      if (isEdit && eventToEdit) {
        await fetch(`/api/events/${eventToEdit.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
      } else {
        await fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
      }

      await onSave()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-navy-950/80 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative z-10 w-full max-w-md mx-4 bg-smoke-900 border border-smoke-700 rounded-xl shadow-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-smoke-100 tracking-wide uppercase">
            {isEdit ? "Edit event" : "New event"}
          </h2>
          <button
            onClick={onClose}
            className="text-smoke-500 hover:text-smoke-200 transition-colors text-lg leading-none"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs text-smoke-300 mb-1">Title</label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Event name..."
              className="w-full bg-smoke-800 border border-smoke-600 rounded-lg px-3 py-2 text-sm text-smoke-100 placeholder-smoke-500 focus:outline-none focus:border-doom-gold transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs text-smoke-300 mb-1">
              Description <span className="text-smoke-500">(optional)</span>
            </label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Additional notes..."
              className="w-full bg-smoke-800 border border-smoke-600 rounded-lg px-3 py-2 text-sm text-smoke-100 placeholder-smoke-500 focus:outline-none focus:border-doom-gold transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs text-smoke-300 mb-1">Date</label>
            <input
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className="w-full bg-smoke-800 border border-smoke-600 rounded-lg px-3 py-2 text-sm text-smoke-100 focus:outline-none focus:border-doom-gold transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-smoke-300 mb-1">Start</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full bg-smoke-800 border border-smoke-600 rounded-lg px-3 py-2 text-sm text-smoke-100 focus:outline-none focus:border-doom-gold transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs text-smoke-300 mb-1">End</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full bg-smoke-800 border border-smoke-600 rounded-lg px-3 py-2 text-sm text-smoke-100 focus:outline-none focus:border-doom-gold transition-colors"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={flexible}
              onChange={(e) => setFlexible(e.target.checked)}
              className="accent-doom-gold"
            />
            <span className="text-xs text-smoke-300">
              Flexible event — Plando can reschedule it
            </span>
          </label>

          <div className="flex items-center justify-between pt-1">
            {isEdit && eventToEdit ? (
              <button
                type="button"
                onClick={() => onDelete(eventToEdit.id)}
                className="text-xs text-doom-ember hover:text-red-400 transition-colors"
              >
                Delete event
              </button>
            ) : (
              <div />
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-smoke-400 hover:text-smoke-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!title.trim() || loading}
                className="px-4 py-2 text-sm font-medium bg-doom-gold text-navy-950 rounded-lg hover:bg-doom-gold/80 disabled:opacity-40 transition-colors"
              >
                {loading ? "..." : isEdit ? "Save" : "Create"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
