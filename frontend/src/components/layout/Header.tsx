// import * as React from "react"
import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ModeToggle } from "../mode-toggle"

interface HeaderProps {
  sidebarOpen: boolean
  onToggleSidebar: () => void
}

export function Header({ sidebarOpen, onToggleSidebar }: HeaderProps) {
  return (
    <header className="fixed top-0 right-0 z-30 h-16 bg-background/95 backdrop-blur-sm border-b" 
            style={{ left: sidebarOpen ? '256px' : '64px' }}>
      <div className="flex items-center justify-between h-full px-6">
        {/* Left side - Sidebar toggle */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleSidebar}
            className="h-8 w-8"
          >
            <Menu className="h-4 w-4" />
          </Button>
          
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Steam Review Analyzer
            </h2>
          </div>
        </div>

        {/* Right side - Actions */}
        <div className="flex items-center gap-3">
          {/* Theme Toggle */}
          <ModeToggle />
        </div>
      </div>
    </header>
  )
}