import { useState } from "react"
import { Outlet } from "react-router-dom"
import { Sidebar } from "./Sidebar"
import { Header } from "./Header"
import { cn } from "@/lib/utils"

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/10">
      {/* Sidebar */}
      <Sidebar 
        open={sidebarOpen} 
        onOpenChange={setSidebarOpen}
      />
      
      {/* Main Content */}
      <div className={cn(
        "transition-all duration-300 ease-in-out",
        sidebarOpen ? "ml-64" : "ml-16"
      )}>
        {/* Header */}
        <Header 
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        />
        
        {/* Page Content */}
        <main className="p-6 pt-20 min-h-screen">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Main Content */}
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}