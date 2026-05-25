interface TimeSlotProps {
  ora: number
  onClick: () => void
}

export default function TimeSlot({ ora, onClick }: TimeSlotProps) {
  return (
    <div
      onClick={onClick}
      className="h-16 border-b border-smoke-800/40 hover:bg-navy-900/60 transition-colors cursor-pointer"
      aria-label={`Slot ${String(ora).padStart(2, "0")}:00`}
    />
  )
}
