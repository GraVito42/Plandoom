import TimeSlot from "./TimeSlot"

interface DayColumnProps {
  giorno: string
  ore: number[]
}

export default function DayColumn({ giorno, ore }: DayColumnProps) {
  return (
    <div className="flex-1 border-l border-smoke-800 min-w-0">
      {ore.map((ora) => (
        <TimeSlot key={ora} ora={ora} giorno={giorno} />
      ))}
    </div>
  )
}
