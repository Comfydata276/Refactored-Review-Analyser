import { useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { RefreshCw, FolderOpen, Server, Monitor } from 'lucide-react'
import { useElectron } from '@/hooks/useElectron'
import { toast } from 'sonner'

export function ElectronStatusBar() {
  const {
    isElectron,
    platform,
    appVersion,
    backendStatus,
    refreshBackendStatus,
    restartBackend,
    openOutputFolder
  } = useElectron()

  // Auto-refresh backend status every 30 seconds
  useEffect(() => {
    if (!isElectron) return

    const interval = setInterval(refreshBackendStatus, 30000)
    return () => clearInterval(interval)
  }, [isElectron, refreshBackendStatus])

  // Don't render if not in Electron
  if (!isElectron) return null

  const handleRestartBackend = async () => {
    toast.info('Restarting backend server...')
    const success = await restartBackend()
    if (success) {
      toast.success('Backend server restarted successfully')
    } else {
      toast.error('Failed to restart backend server')
    }
  }

  const handleOpenOutputFolder = async () => {
    const success = await openOutputFolder()
    if (success) {
      toast.success('Output folder opened')
    } else {
      toast.error('Failed to open output folder')
    }
  }

  return (
    <Card className="border-primary/20 bg-card/50 backdrop-blur-sm">
      <CardContent className="flex items-center justify-between p-4">
        <div className="flex items-center gap-4">
          {/* App Info */}
          <div className="flex items-center gap-2">
            <Monitor className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Desktop App</span>
            {appVersion && (
              <Badge variant="outline" className="text-xs">
                v{appVersion}
              </Badge>
            )}
            {platform && (
              <Badge variant="secondary" className="text-xs capitalize">
                {platform}
              </Badge>
            )}
          </div>

          {/* Backend Status */}
          <div className="flex items-center gap-2">
            <Server className="h-4 w-4" />
            <span className="text-sm">Backend:</span>
            {backendStatus ? (
              <Badge 
                variant={backendStatus.running ? "default" : "destructive"}
                className="text-xs"
              >
                {backendStatus.running ? (
                  `Running (${backendStatus.host}:${backendStatus.port})`
                ) : (
                  'Stopped'
                )}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs">
                Checking...
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Refresh Backend Status */}
          <Button
            variant="ghost"
            size="sm"
            onClick={refreshBackendStatus}
            className="h-8 w-8 p-0"
          >
            <RefreshCw className="h-3 w-3" />
          </Button>

          {/* Restart Backend */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRestartBackend}
            className="text-xs"
          >
            <Server className="h-3 w-3 mr-1" />
            Restart Backend
          </Button>

          {/* Open Output Folder */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenOutputFolder}
            className="text-xs"
          >
            <FolderOpen className="h-3 w-3 mr-1" />
            Output Folder
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}