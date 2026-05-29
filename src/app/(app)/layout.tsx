import AppDndProvider from "@/components/AppDndProvider"
import AppSidebar from "@/components/AppSidebar"
import NavBar from "@/components/NavBar"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppDndProvider>
      <div className="flex flex-col h-full overflow-hidden">
        <NavBar />
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <AppSidebar />
          <main className="flex-1 overflow-hidden">
            {children}
          </main>
        </div>
      </div>
    </AppDndProvider>
  )
}
