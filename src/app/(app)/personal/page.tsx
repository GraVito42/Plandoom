import { Suspense } from "react"
import PersonalLayout from "@/components/personal/PersonalLayout"

export default function PersonalPage() {
  return (
    <Suspense>
      <PersonalLayout />
    </Suspense>
  )
}
