"use client"

import { useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"

type GlandoStatus = {
  connected: boolean
  lastSync: string | null
}

type SyncResult = {
  created: number
  updated: number
  exported: number
}

interface GlandoProps {
  onClose: () => void
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

export default function Glando({ onClose }: GlandoProps) {
  const queryClient = useQueryClient()
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data: status, isLoading } = useQuery<GlandoStatus>({
    queryKey: ["glando-status"],
    queryFn: async () => {
      const res = await fetch("/api/glando/status")
      return res.json() as Promise<GlandoStatus>
    },
  })

  async function syncNow() {
    setSyncing(true)
    setError(null)
    setSyncResult(null)
    try {
      const res = await fetch("/api/glando/sync", { method: "POST" })
      if (!res.ok) throw new Error()
      const data = (await res.json()) as SyncResult
      setSyncResult(data)
      await queryClient.invalidateQueries({ queryKey: ["events"] })
      await queryClient.invalidateQueries({ queryKey: ["glando-status"] })
    } catch {
      setError("Sync failed. Check your Google Calendar connection.")
    } finally {
      setSyncing(false)
    }
  }

  async function disconnect() {
    setDisconnecting(true)
    try {
      await fetch("/api/glando/status", { method: "DELETE" })
      await queryClient.invalidateQueries({ queryKey: ["glando-status"] })
      setSyncResult(null)
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-navy-950/80 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-md mx-4 bg-smoke-900 border border-smoke-700 rounded-xl shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-smoke-700">
          <div>
            <h2 className="text-sm font-semibold text-smoke-100 uppercase tracking-widest">Glando</h2>
            <p className="text-[10px] text-smoke-500 mt-0.5">Google Calendar sync engine</p>
          </div>
          <button onClick={onClose} className="text-smoke-500 hover:text-smoke-200 transition-colors text-lg leading-none">✕</button>
        </div>

        <div className="p-5 flex flex-col gap-5">
          {isLoading && (
            <p className="text-xs text-smoke-500 text-center py-4">Checking connection…</p>
          )}

          {!isLoading && status && (
            <>
              {/* Connection status */}
              <div className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${status.connected ? "border-green-800/50 bg-green-900/10" : "border-smoke-700 bg-smoke-800/30"}`}>
                <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${status.connected ? "bg-green-400" : "bg-smoke-600"}`} />
                <div className="min-w-0">
                  <p className="text-xs font-medium text-smoke-100">
                    {status.connected ? "Connected to Google Calendar" : "Not connected"}
                  </p>
                  {status.connected && status.lastSync && (
                    <p className="text-[10px] text-smoke-500 mt-0.5">Last sync: {fmtDate(status.lastSync)}</p>
                  )}
                  {status.connected && !status.lastSync && (
                    <p className="text-[10px] text-smoke-500 mt-0.5">Never synced — click Sync now to start</p>
                  )}
                </div>
              </div>

              {/* Sync result */}
              {syncResult && (
                <div className="rounded-lg border border-smoke-700 bg-smoke-800/30 px-4 py-3 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-lg font-bold text-doom-gold">{syncResult.created}</p>
                    <p className="text-[10px] text-smoke-400">Imported</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-smoke-200">{syncResult.updated}</p>
                    <p className="text-[10px] text-smoke-400">Updated</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold text-smoke-200">{syncResult.exported}</p>
                    <p className="text-[10px] text-smoke-400">Exported</p>
                  </div>
                </div>
              )}

              {error && (
                <p className="text-xs text-doom-ember bg-doom-ember/10 border border-doom-ember/30 rounded px-3 py-2">{error}</p>
              )}

              {/* How sync works */}
              {status.connected && !syncResult && (
                <div className="text-[10px] text-smoke-500 leading-relaxed space-y-1">
                  <p>• <span className="text-smoke-400">GCal → PlanDoom</span>: new Google Calendar events are imported into your grid</p>
                  <p>• <span className="text-smoke-400">PlanDoom → GCal</span>: events you created in PlanDoom are pushed to Google Calendar</p>
                  <p className="text-smoke-600 pt-1">Chips are never synced.</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col gap-2">
                {!status.connected ? (
                  <a
                    href="/api/glando/connect"
                    className="w-full px-4 py-2.5 text-sm font-medium text-center bg-doom-gold text-navy-950 rounded-lg hover:bg-doom-gold/80 transition-colors"
                  >
                    Connect Google Calendar
                  </a>
                ) : (
                  <>
                    <button
                      onClick={syncNow}
                      disabled={syncing}
                      className="w-full px-4 py-2.5 text-sm font-medium bg-doom-gold text-navy-950 rounded-lg hover:bg-doom-gold/80 disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
                    >
                      {syncing ? (
                        <><span className="inline-block w-3 h-3 border-2 border-navy-950/30 border-t-navy-950 rounded-full animate-spin" />Syncing…</>
                      ) : "Sync now"}
                    </button>
                    <button
                      onClick={disconnect}
                      disabled={disconnecting}
                      className="w-full px-4 py-2 text-xs text-smoke-500 hover:text-doom-ember transition-colors disabled:opacity-40"
                    >
                      {disconnecting ? "Disconnecting…" : "Disconnect Google Calendar"}
                    </button>
                  </>
                )}
              </div>

              {!status.connected && (
                <p className="text-[10px] text-smoke-600 text-center leading-relaxed">
                  Requires <code className="text-smoke-500">GOOGLE_CLIENT_ID</code> and <code className="text-smoke-500">GOOGLE_CLIENT_SECRET</code> in your environment.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
