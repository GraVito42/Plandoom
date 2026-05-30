"use client"

import { useSearchParams, useRouter } from "next/navigation"
import ColorPresetsTab from "./tabs/ColorPresetsTab"
import FolderManager from "@/components/folders/FolderManager"

const TABS = [
  { id: "presets", label: "Presets" },
  { id: "settings", label: "Default Settings" },
  { id: "graphics", label: "Global Graphics" },
  { id: "folders", label: "Folders" },
] as const

type TabId = (typeof TABS)[number]["id"]

export default function PersonalLayout() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const activeTab = (searchParams.get("tab") as TabId | null) ?? "presets"

  function setTab(id: TabId) {
    router.push(`/personal?tab=${id}`)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="shrink-0 border-b border-smoke-800 px-6 flex gap-0.5">
        {TABS.map(({ id, label }) => (
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
      </div>

      <div className="flex-1 overflow-y-auto p-6 max-w-3xl">
        {activeTab === "presets" && <ColorPresetsTab />}
        {activeTab === "settings" && <SettingsPlaceholder />}
        {activeTab === "graphics" && <GraphicsPlaceholder />}
        {activeTab === "folders" && <FolderManager />}
      </div>
    </div>
  )
}

function SettingsPlaceholder() {
  return <p className="text-xs text-smoke-500">Default Event Settings — coming soon</p>
}

function GraphicsPlaceholder() {
  return <p className="text-xs text-smoke-500">Global Graphics — coming soon</p>
}
