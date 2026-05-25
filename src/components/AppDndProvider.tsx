"use client"

import { DndContext, PointerSensor, useSensor, useSensors } from "@dnd-kit/core"
import type { ReactNode } from "react"

// Provides a single DndContext for the whole app layout so chips can be
// dragged from the sidebar/Pouch into the grid.
export default function AppDndProvider({ children }: { children: ReactNode }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )
  return <DndContext sensors={sensors}>{children}</DndContext>
}
