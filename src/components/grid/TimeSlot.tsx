interface TimeSlotProps {
  hour: number
  onClick: () => void
}

export default function TimeSlot({ hour, onClick }: TimeSlotProps) {
  return (
    <div
      onClick={onClick}
      className="h-16 border-b border-smoke-700/40 hover:bg-navy-900/60 transition-colors cursor-pointer relative"
      aria-label={`${String(hour).padStart(2, "0")}:00`}
    >
      <div className="absolute left-0 right-0 top-1/2 border-t border-smoke-700/20 pointer-events-none" />
    </div>
  )
}
