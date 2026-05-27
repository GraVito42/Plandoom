"use client"

const PRODUCTIVITY_MODELS = [
  { value: "", label: "No model" },
  { value: "timeboxing", label: "Timeboxing" },
  { value: "deep_work", label: "Deep Work" },
  { value: "pomodoro", label: "Pomodoro" },
  { value: "energy_matching", label: "Energy Matching" },
]

type ProdoDraft = {
  mentalEnergy: number
  physicalEnergy: number
  difficulty: number
  pleasure: number
  isFixed: boolean
  productivityModel: string
}

interface ProDoPanelProps {
  draft: ProdoDraft
  onChange: (patch: Partial<ProdoDraft>) => void
}

function Slider({ label, icon, value, onChange }: { label: string; icon: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-smoke-400">{icon} {label}</span>
        <span className="text-[10px] text-doom-gold font-mono">{value}</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-doom-gold h-1"
      />
    </div>
  )
}

export default function ProDoPanel({ draft, onChange }: ProDoPanelProps) {
  return (
    <div className="flex flex-col gap-4 py-2">
      {/* Productivity model */}
      <div>
        <label className="block text-[10px] text-smoke-500 mb-1">Productivity model</label>
        <select
          value={draft.productivityModel}
          onChange={(e) => onChange({ productivityModel: e.target.value })}
          className="bg-smoke-800 border border-smoke-700 text-smoke-200 text-xs rounded px-2 py-1.5 w-full"
        >
          {PRODUCTIVITY_MODELS.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      </div>

      {/* Fixed toggle */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={draft.isFixed}
          onChange={(e) => onChange({ isFixed: e.target.checked })}
          className="accent-doom-gold"
        />
        <div>
          <p className="text-xs text-smoke-200">Fixed — Prodo won't move this event</p>
        </div>
      </label>

      {/* Sliders */}
      <div className="flex flex-col gap-3">
        <Slider label="Mental Energy" icon="🧠" value={draft.mentalEnergy} onChange={(v) => onChange({ mentalEnergy: v })} />
        <Slider label="Physical Energy" icon="💪" value={draft.physicalEnergy} onChange={(v) => onChange({ physicalEnergy: v })} />
        <Slider label="Difficulty" icon="⚡" value={draft.difficulty} onChange={(v) => onChange({ difficulty: v })} />
        <Slider label="Pleasure" icon="✨" value={draft.pleasure} onChange={(v) => onChange({ pleasure: v })} />
      </div>

      {/* Optimality */}
      <div className="flex items-center justify-between px-3 py-2 bg-doom-rune/10 border border-doom-rune/30 rounded-lg">
        <span className="text-[10px] text-smoke-400">Optimality</span>
        <span className="text-xs text-smoke-500 italic">Run Prodo to calculate</span>
      </div>
    </div>
  )
}
