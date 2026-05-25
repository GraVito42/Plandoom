interface TimeSlotProps {
  hour: number
  onClick: () => void
}

export default function TimeSlot({ hour, onClick }: TimeSlotProps) {
  return (
    <div
      onClick={onClick}
      className="h-16 border-b border-smoke-700/40 hover:bg-navy-900/60 transition-colors cursor-pointer"
      aria-label={`${String(hour).padStart(2, "0")}:00`}
    />
  )
}
