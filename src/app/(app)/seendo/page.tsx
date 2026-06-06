"use client"

import { SeendoPanel } from "@/components/magic/Seendo"

export default function SeendoPage() {
  return (
    <div className="h-full bg-navy-950 overflow-y-auto flex flex-col items-center py-10 px-4">
      <div className="w-full max-w-md">
        <SeendoPanel />
      </div>
    </div>
  )
}
