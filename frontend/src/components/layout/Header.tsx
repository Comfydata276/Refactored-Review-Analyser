// import * as React from "react"
import { Bell, Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ModeToggle } from "../mode-toggle"
import { cn } from "@/lib/utils"

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
          {/* Notifications */}
          <Button variant="ghost" size="icon" className="relative h-9 w-9">
            <Bell className="h-4 w-4" />
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs"
            >
              3
            </Badge>
          </Button>

          {/* Theme Toggle */}
          <ModeToggle />

          {/* User Avatar */}
          <div className="flex items-center gap-3 pl-3 border-l">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary/10 text-primary font-medium">
                SA
              </AvatarFallback>
            </Avatar>
            <div className="hidden sm:block text-sm">
              <p className="font-medium">Steam Analyzer</p>
              <p className="text-xs text-muted-foreground">Desktop App</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}