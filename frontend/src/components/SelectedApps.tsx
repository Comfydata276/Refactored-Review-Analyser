import { useState } from 'react'
import { X, GamepadIcon, Trash2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

import { setConfig } from '../api/ApiClient'
import { cn } from "@/lib/utils"

interface SelectedApp {
  appid: number
  name?: string
}

interface SelectedAppsProps {
  apps: SelectedApp[]
  config: any
  onConfigUpdate: (newConfig: any) => void
  className?: string
}

export function SelectedApps({ apps, config, onConfigUpdate, className }: SelectedAppsProps) {
  const [loading, setLoading] = useState(false)

  // Remove a single app from the collection
  const removeApp = async (appid: number) => {
    if (!config) return
    
    setLoading(true)
    try {
      const updatedApps = (config.selected_apps || []).filter((app: any) => app.appid !== appid)
      const newConfig = { 
        ...config, 
        selected_apps: updatedApps,
        app_ids: updatedApps.map((app: any) => app.appid)
      }
      
      await setConfig(newConfig)
      onConfigUpdate(newConfig)
      
      const appName = apps.find(app => app.appid === appid)?.name || `App ${appid}`
      toast.success(`Removed "${appName}" from your collection`)
    } catch (error) {
      console.error('Failed to remove app:', error)
      toast.error("Failed to remove app from collection")
    } finally {
      setLoading(false)
    }
  }

  // Clear all selected apps
  const clearAllApps = async () => {
    if (!config) return
    
    setLoading(true)
    try {
      const newConfig = { 
        ...config, 
        selected_apps: [],
        app_ids: []
      }
      await setConfig(newConfig)
      onConfigUpdate(newConfig)
      
      toast.success(`Cleared all ${apps.length} apps from your collection`)
    } catch (error) {
      console.error('Failed to clear apps:', error)
      toast.error("Failed to clear apps from collection")
    } finally {
      setLoading(false)
    }
  }

  if (apps.length === 0) {
    return (
      <Card className={cn("border-dashed border-2 border-muted-foreground/25", className)}>
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <div className="p-4 rounded-full bg-muted/50 mb-4">
            <GamepadIcon className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No games selected</h3>
          <p className="text-muted-foreground text-sm max-w-sm">
            Search and select games above to add them to your analysis collection.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn("border border-border/50 bg-card/80 backdrop-blur-sm", className)}>
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <div>
          <CardTitle className="text-xl flex items-center gap-2">
            <GamepadIcon className="h-5 w-5" />
            Selected Games
          </CardTitle>
          <CardDescription>
            {apps.length} game{apps.length !== 1 ? 's' : ''} in your collection
          </CardDescription>
        </div>
        
        {apps.length > 0 && (
          <Dialog>
            <DialogTrigger asChild>
              <Button 
                variant="outline" 
                size="sm"
                disabled={loading}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear All
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Clear all games?</DialogTitle>
                <DialogDescription>
                  This will remove all {apps.length} games from your collection. This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline">Cancel</Button>
                <Button 
                  onClick={clearAllApps}
                  variant="destructive"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Clearing...
                    </>
                  ) : (
                    'Clear All'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      
      <CardContent>
        <div className="grid gap-3 max-h-96 overflow-y-auto">
          {apps.map((app) => (
            <div
              key={app.appid}
              className="flex items-center justify-between p-3 rounded-lg border bg-card/50 hover:bg-card/80 transition-colors group"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="p-2 rounded-md bg-primary/10 border border-primary/20 flex-shrink-0">
                  <GamepadIcon className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm truncate">
                    {app.name || `App ${app.appid}`}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    ID: {app.appid}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge variant="secondary" className="text-xs">
                  Ready
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeApp(app.appid)}
                  disabled={loading}
                  className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                >
                  {loading ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <X className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
        
        {apps.length > 5 && (
          <div className="mt-4 pt-4 border-t text-center">
            <p className="text-xs text-muted-foreground">
              Showing all {apps.length} games • Scroll to see more
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}