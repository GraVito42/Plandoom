"use client"

interface LindoPanelProps {
  isExternalLinked: boolean
  onChange: (v: boolean) => void
}

export default function LindoPanel({ isExternalLinked, onChange }: LindoPanelProps) {
  return (
    <div className="flex flex-col gap-4 py-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-smoke-200">Google Calendar</p>
          <p className="text-[10px] text-smoke-500 mt-0.5">Link this event to GCal</p>
        </div>
        <button
          type="button"
          onClick={() => onChange(!isExternalLinked)}
          className={`relative w-10 h-5 rounded-full transition-colors ${
            isExternalLinked ? "bg-green-600" : "bg-smoke-600"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
              isExternalLinked ? "translate-x-5" : ""
            }`}
          />
        </button>
      </div>

      {isExternalLinked && (
        <div className="flex items-center gap-2 px-3 py-2 bg-green-900/20 border border-green-800/40 rounded-lg">
          <div className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
          <p className="text-[10px] text-green-300">Linked — a green border will appear on the grid block</p>
        </div>
      )}

      <p className="text-[10px] text-smoke-600 leading-relaxed">
        Run <span className="text-smoke-500">Lindo sync</span> from the toolbar to push changes to Google Calendar.
      </p>
    </div>
  )
}
