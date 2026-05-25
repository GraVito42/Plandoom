interface TimeSlotProps {
  ora: number
  giorno: string
}

export default function TimeSlot({ ora, giorno }: TimeSlotProps) {
  return (
    <div
      className="h-16 border-b border-smoke-800/40 hover:bg-navy-900/60 transition-colors cursor-pointer"
      aria-label={`${giorno} ${String(ora).padStart(2, "0")}:00`}
    />
  )
}
