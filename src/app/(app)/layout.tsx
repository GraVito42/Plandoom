export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full overflow-hidden">
      {/* Sidebar Note Settimanali */}
      <aside className="w-52 shrink-0 flex flex-col bg-smoke-900 border-r border-smoke-800">
        <div className="px-4 py-3 border-b border-smoke-800 shrink-0">
          <h3 className="text-xs font-semibold text-smoke-300 uppercase tracking-widest">
            Weekly Notes
          </h3>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <p className="text-xs text-smoke-500 italic">No notes...</p>
        </div>
      </aside>

      {/* Contenuto settimana */}
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  )
}
