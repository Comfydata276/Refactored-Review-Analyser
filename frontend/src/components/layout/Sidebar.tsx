// import * as React from "react"
import { Link, useLocation } from "react-router-dom"
import { 
  Home, 
  Search, 
  Settings, 
  BarChart3, 
  Edit, 
  HelpCircle,
  GamepadIcon,
  ChevronLeft,
  ChevronRight
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface SidebarProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const navigationItems = [
  {
    title: "Dashboard",
    href: "/",
    icon: Home,
    description: "Overview and status"
  },
  {
    title: "Game Finder",
    href: "/finder",
    icon: Search,
    description: "Discover Steam games"
  },
  {
    title: "Prompt Editor",
    href: "/prompt",
    icon: Edit,
    description: "Configure AI analysis"
  },
  {
    title: "Results",
    href: "/results",
    icon: BarChart3,
    description: "View analysis results",
    badge: "New"
  }
]

const secondaryItems = [
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
    description: "App configuration"
  },
  {
    title: "Help",
    href: "/help",
    icon: HelpCircle,
    description: "Documentation"
  }
]

export function Sidebar({ open, onOpenChange }: SidebarProps) {
  const location = useLocation()

  return (
    <div className={cn(
      "fixed left-0 top-0 z-40 h-screen bg-card/95 backdrop-blur-sm border-r transition-all duration-300 ease-in-out",
      open ? "w-64" : "w-16"
    )}>
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <div className={cn(
            "flex items-center gap-3",
            !open && "justify-center"
          )}>
            <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
              <GamepadIcon className="h-6 w-6 text-primary" />
            </div>
            {open && (
              <div>
                <h1 className="font-bold text-lg bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                  Steam Analyzer
                </h1>
                <p className="text-xs text-muted-foreground">Review Analysis Tool</p>
              </div>
            )}
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onOpenChange(!open)}
            className="h-8 w-8"
          >
            {open ? (
              <ChevronLeft className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Navigation */}
      <div className="p-4 space-y-2">
        {/* Primary Navigation */}
        <div className="space-y-1">
          {navigationItems.map((item) => {
            const isActive = location.pathname === item.href
            const Icon = item.icon
            
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 group",
                  isActive 
                    ? "bg-primary/10 text-primary border border-primary/20 shadow-sm" 
                    : "hover:bg-muted/50 hover:text-foreground text-muted-foreground",
                  !open && "justify-center px-2"
                )}
              >
                <Icon className={cn(
                  "h-5 w-5 transition-colors",
                  isActive ? "text-primary" : "group-hover:text-foreground"
                )} />
                
                {open && (
                  <>
                    <span className="flex-1">{item.title}</span>
                    {item.badge && (
                      <Badge variant="secondary" className="text-xs px-2 py-0">
                        {item.badge}
                      </Badge>
                    )}
                  </>
                )}
                
                {!open && isActive && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-popover border rounded-md shadow-md text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    {item.title}
                  </div>
                )}
              </Link>
            )
          })}
        </div>

        <Separator className="my-4" />

        {/* Secondary Navigation */}
        <div className="space-y-1">
          {open && (
            <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              System
            </p>
          )}
          
          {secondaryItems.map((item) => {
            const isActive = location.pathname === item.href
            const Icon = item.icon
            
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 group",
                  isActive 
                    ? "bg-primary/10 text-primary border border-primary/20 shadow-sm" 
                    : "hover:bg-muted/50 hover:text-foreground text-muted-foreground",
                  !open && "justify-center px-2"
                )}
              >
                <Icon className={cn(
                  "h-5 w-5 transition-colors",
                  isActive ? "text-primary" : "group-hover:text-foreground"
                )} />
                
                {open && <span className="flex-1">{item.title}</span>}
                
                {!open && isActive && (
                  <div className="absolute left-full ml-2 px-2 py-1 bg-popover border rounded-md shadow-md text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    {item.title}
                  </div>
                )}
              </Link>
            )
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="absolute bottom-4 left-4 right-4">
        {open ? (
          <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-2 w-2 rounded-full bg-green-500"></div>
              <span className="text-xs font-medium">Status: Connected</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Backend services running
            </p>
          </div>
        ) : (
          <div className="flex justify-center">
            <div className="h-2 w-2 rounded-full bg-green-500"></div>
          </div>
        )}
      </div>
    </div>
  )
}