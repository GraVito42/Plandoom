import AppDndProvider from "@/components/AppDndProvider"
import WeeklySidebar from "@/components/chips/WeeklySidebar"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppDndProvider>
      <div className="flex h-full overflow-hidden">
        <aside className="w-52 shrink-0 bg-smoke-900 border-r border-smoke-800">
          <WeeklySidebar />
        </aside>
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>
    </AppDndProvider>
  )
}
