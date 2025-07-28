// src/components/ProcessStatusCard.tsx
import { Activity, Download, BarChart3, Square, Pause, Play } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ProcessStatus } from '../types/websocket'

interface ProcessStatusCardProps {
  status: ProcessStatus
  onStop: () => void
  onPause?: () => void
  onResume?: () => void
}

const getProcessIcon = (processType: ProcessStatus['processType']) => {
  switch (processType) {
    case 'scraping': return Download
    case 'analysis': return BarChart3
    default: return Activity
  }
}

const getProcessLabel = (processType: ProcessStatus['processType']) => {
  switch (processType) {
    case 'scraping': return 'Scraping Reviews'
    case 'analysis': return 'Analyzing Data'
    default: return 'Process Status'
  }
}

const getProcessColor = (processType: ProcessStatus['processType'], isRunning: boolean) => {
  if (isRunning) {
    switch (processType) {
      case 'scraping': return 'text-green-500'
      case 'analysis': return 'text-purple-500'
      default: return 'text-blue-500'
    }
  } else {
    // Show color for completed processes too
    switch (processType) {
      case 'scraping': return 'text-green-600'
      case 'analysis': return 'text-purple-600'
      default: return 'text-muted-foreground'
    }
  }
}

export function ProcessStatusCard({ status, onStop, onPause, onResume }: ProcessStatusCardProps) {
  const ProcessIcon = getProcessIcon(status.processType)
  const processLabel = getProcessLabel(status.processType)
  const iconColor = getProcessColor(status.processType, status.isRunning)


  return (
    <Card className={cn(
      "border-2 transition-all duration-300",
      status.isRunning 
        ? "border-primary/20 bg-primary/5 shadow-lg" 
        : "border-border hover:border-border/60"
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <ProcessIcon className={cn(
              "h-5 w-5 transition-all duration-300",
              status.isRunning && "animate-pulse",
              iconColor
            )} />
            {processLabel}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge 
              variant={status.isRunning ? "default" : status.processType !== 'idle' ? "secondary" : "outline"}
              className={cn(
                "transition-all duration-300",
                status.isRunning && "animate-pulse",
                !status.isRunning && status.processType === 'scraping' && "bg-green-100 text-green-800 border-green-200",
                !status.isRunning && status.processType === 'analysis' && "bg-purple-100 text-purple-800 border-purple-200"
              )}
            >
              {status.isRunning ? "Running" : status.processType !== 'idle' ? "Complete" : "Idle"}
            </Badge>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Status Message */}
        <div>
          <p className={cn(
            "text-sm transition-colors duration-300",
            status.isRunning ? "text-foreground" : 
            status.processType !== 'idle' ? "text-foreground" : "text-muted-foreground"
          )}>
            {status.statusMessage}
          </p>
          
          {/* Current Item */}
          {status.currentItem && status.isRunning && (
            <p className="text-xs text-muted-foreground mt-1 font-mono">
              Current: {status.currentItem}
            </p>
          )}

          {/* Completion Indicator */}
          {!status.isRunning && status.processType !== 'idle' && (
            <p className="text-xs text-muted-foreground mt-1">
              {status.processType === 'scraping' ? '✓ Scraping completed' : '✓ Analysis completed'}
            </p>
          )}
        </div>

        {/* Progress Information */}
        {status.progress && status.isRunning && (
          <div className="space-y-3">
            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{status.progress.current} of {status.progress.total}</span>
                <span>{status.progress.percentage.toFixed(1)}%</span>
              </div>
              <Progress 
                value={status.progress.percentage} 
                className="h-2 transition-all duration-300"
              />
            </div>

            {/* Additional Progress Info */}
            <div className="grid grid-cols-2 gap-4 text-xs">
              {status.progress.eta && (
                <div>
                  <span className="text-muted-foreground">ETA:</span>
                  <span className="ml-1 font-mono">{status.progress.eta}</span>
                </div>
              )}
              {status.progress.speed && (
                <div>
                  <span className="text-muted-foreground">Speed:</span>
                  <span className="ml-1 font-mono">{status.progress.speed}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Control Buttons */}
        {status.isRunning && (
          <div className="flex items-center gap-2 pt-2">
            <Button
              onClick={onStop}
              variant="destructive"
              size="sm"
              className="flex-1"
            >
              <Square className="h-3 w-3 mr-1" />
              Stop Process
            </Button>
            
            {/* Future enhancement: Pause/Resume functionality */}
            {onPause && onResume && (
              <Button
                onClick={onPause}
                variant="outline"
                size="sm"
                className="px-3"
              >
                <Pause className="h-3 w-3" />
              </Button>
            )}
          </div>
        )}

        {/* Last Activity Timestamp */}
        {status.lastActivity && (
          <div className="text-xs text-muted-foreground pt-2 border-t">
            Last activity: {new Date(status.lastActivity).toLocaleTimeString()}
          </div>
        )}
      </CardContent>
    </Card>
  )
}