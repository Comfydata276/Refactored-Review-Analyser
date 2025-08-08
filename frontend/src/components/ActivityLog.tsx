// src/components/ActivityLog.tsx
import { useEffect, useRef } from 'react'
import { 
  Activity, 
  AlertCircle, 
  AlertTriangle, 
  CheckCircle, 
  Info,
  Download,
  BarChart3,
  Clock,
  Zap
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import type { WSMessage } from '../types/websocket'

interface ActivityLogProps {
  messages: WSMessage[]
  isConnected: boolean
  maxHeight?: string
  onClear?: () => void
}

const getMessageIcon = (msg: WSMessage) => {
  // Priority: specific type > level > fallback
  if (msg.type === 'progress') return BarChart3
  if (msg.process_type === 'scraping') return Download
  if (msg.process_type === 'analysis') return Zap
  
  switch (msg.level?.toLowerCase()) {
    case 'error': return AlertCircle
    case 'warning': return AlertTriangle
    case 'success': return CheckCircle
    case 'info': return Info
    default: return Activity
  }
}

const getMessageColor = (msg: WSMessage) => {
  if (msg.type === 'progress') return 'text-blue-500'
  if (msg.process_type === 'scraping') return 'text-green-500'
  if (msg.process_type === 'analysis') return 'text-purple-500'
  
  switch (msg.level?.toLowerCase()) {
    case 'error': return 'text-red-500'
    case 'warning': return 'text-amber-500'
    case 'success': return 'text-green-500'
    default: return 'text-blue-500'
  }
}

const formatTimestamp = (timestamp?: string) => {
  if (!timestamp) return new Date().toLocaleTimeString()
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

const formatMessage = (msg: WSMessage): string => {
  // Handle progress messages specially
  if (msg.progress) {
    const { current, total, percentage, eta, speed } = msg.progress
    let progressMsg = `Progress: ${current}/${total} (${percentage.toFixed(1)}%)`
    if (eta) progressMsg += ` • ETA: ${eta}`
    if (speed) progressMsg += ` • ${speed}`
    return progressMsg
  }
  
  // Handle status messages
  if (msg.type === 'status' && msg.current_item) {
    return `${msg.message || 'Processing'}: ${msg.current_item}`
  }
  
  // Default message formatting
  return msg.message || JSON.stringify(msg, null, 2)
}

const getMessageCategory = (msg: WSMessage): string => {
  if (msg.type === 'progress') return 'PROGRESS'
  if (msg.process_type === 'scraping') return 'SCRAPER'
  if (msg.process_type === 'analysis') return 'ANALYSIS'
  if (msg.level) return msg.level.toUpperCase()
  return 'SYSTEM'
}

export function ActivityLog({ messages, isConnected, maxHeight = 'h-96', onClear }: ActivityLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const shouldAutoScroll = useRef(true)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (shouldAutoScroll.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Handle manual scrolling - disable auto-scroll if user scrolls up
  const handleScroll = () => {
    if (!scrollRef.current) return
    
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    const isNearBottom = scrollTop + clientHeight >= scrollHeight - 50
    shouldAutoScroll.current = isNearBottom
  }

  const scrollToBottom = () => {
    shouldAutoScroll.current = true
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }

  const clearLog = () => {
    if (typeof onClear === 'function') {
      onClear()
    }
  }

  return (
    <div className="space-y-4">
      {/* Log Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-xs">
            {messages.length} entries
          </Badge>
          <Badge 
            variant={isConnected ? "default" : "destructive"} 
            className="text-xs"
          >
            {isConnected ? 'Live' : 'Disconnected'}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={scrollToBottom}
            className="text-xs h-7"
          >
            <Clock className="h-3 w-3 mr-1" />
            Latest
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearLog}
            className="text-xs h-7 text-muted-foreground"
          >
            Clear
          </Button>
        </div>
      </div>

      {/* Log Container */}
      <div 
        ref={scrollRef}
        onScroll={handleScroll}
        className={cn(
          "rounded-lg border bg-muted/20 overflow-auto p-4 space-y-1",
          maxHeight
        )}
      >
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-center">
            <div className="space-y-3">
              <Activity className="h-12 w-12 text-muted-foreground mx-auto opacity-50" />
              <p className="text-muted-foreground">
                {isConnected 
                  ? 'No activity yet. Start a process to see real-time updates.'
                  : 'Connecting to server for real-time updates...'
                }
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            {messages.map((msg: WSMessage, i: number) => {
              const MessageIcon = getMessageIcon(msg)
              const messageColor = getMessageColor(msg)
              const category = getMessageCategory(msg)
              const formattedMessage = formatMessage(msg)
              
              return (
                <div 
                  key={i} 
                  className={cn(
                    "flex items-start gap-3 py-2 px-3 rounded-md transition-colors",
                    "hover:bg-muted/40 border border-transparent hover:border-border/50"
                  )}
                >
                  {/* Icon & Timestamp */}
                  <div className="flex items-center gap-2 min-w-fit">
                    <MessageIcon className={cn("h-3.5 w-3.5 mt-0.5", messageColor)} />
                    <span className="text-xs text-muted-foreground font-mono">
                      {formatTimestamp(msg.timestamp)}
                    </span>
                  </div>
                  
                  <Separator orientation="vertical" className="h-5 mt-0.5" />
                  
                  {/* Category Badge */}
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "text-xs font-mono h-5 px-2 whitespace-nowrap",
                      messageColor
                    )}
                  >
                    {category}
                  </Badge>
                  
                  {/* Message Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm break-words leading-relaxed">
                      {formattedMessage}
                    </p>
                    
                    {/* Progress bar for progress messages */}
                    {msg.progress && (
                      <div className="mt-2 space-y-1">
                        <div className="w-full bg-muted rounded-full h-1.5">
                          <div 
                            className="bg-primary h-1.5 rounded-full transition-all duration-300"
                            style={{ width: `${msg.progress.percentage}%` }}
                          />
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {msg.progress.current} of {msg.progress.total} completed
                          {msg.progress.eta && ` • ETA: ${msg.progress.eta}`}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}