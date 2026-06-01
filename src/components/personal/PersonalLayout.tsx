"use client"

import { useSearchParams, useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import ColorPresetsTab from "./tabs/ColorPresetsTab"
import ShapePresetsSection from "./tabs/ShapePresetsSection"
import DefaultSettingsTab from "./tabs/DefaultSettingsTab"
import GlobalGraphicsTab from "./tabs/GlobalGraphicsTab"
import FolderManager from "@/components/folders/FolderManager"
import AdminTab from "./tabs/AdminTab"

const BASE_TABS = [
  { id: "presets", label: "Presets" },
  { id: "settings", label: "Default Settings" },
  { id: "folders", label: "Folders" },
  { id: "graphics", label: "Global Graphics" },
] as const

type BaseTabId = (typeof BASE_TABS)[number]["id"]
type TabId = BaseTabId | "admin"

export default function PersonalLayout() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const activeTab = (searchParams.get("tab") as TabId | null) ?? "presets"

  const { data: me } = useQuery<{ role: string }>({
    queryKey: ["me"],
    queryFn: () => fetch("/api/me").then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  })

  const isAdmin = me?.role === "admin"

  function setTab(id: TabId) {
    router.push(`/personal?tab=${id}`)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="shrink-0 border-b border-smoke-800 px-6 flex gap-0.5">
        {BASE_TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-4 py-2.5 text-xs transition-colors border-b-2 -mb-px ${
              activeTab === id
                ? "text-doom-gold border-doom-gold"
                : "text-smoke-500 border-transparent hover:text-smoke-300"
            }`}
          >
            {label}
          </button>
        ))}
        {isAdmin && (
          <button
            onClick={() => setTab("admin")}
            className={`px-4 py-2.5 text-xs transition-colors border-b-2 -mb-px ${
              activeTab === "admin"
                ? "text-doom-gold border-doom-gold"
                : "text-smoke-500 border-transparent hover:text-smoke-300"
            }`}
          >
            Admin
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6 max-w-3xl">
        {activeTab === "presets" && (
          <div className="flex flex-col gap-10">
            <ColorPresetsTab />
            <hr className="border-smoke-800" />
            <ShapePresetsSection />
          </div>
        )}
        {activeTab === "settings" && <DefaultSettingsTab />}
        {activeTab === "folders" && <FolderManager />}
        {activeTab === "graphics" && <GlobalGraphicsTab />}
        {activeTab === "admin" && isAdmin && <AdminTab />}
      </div>
    </div>
  )
}



