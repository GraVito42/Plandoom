import { redirect } from "next/navigation"

export default function FoldersPage() {
  redirect("/personal?tab=folders")
}
