import { useMemo } from 'react'
import { Database, Clock, TrendingUp, Target } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { WSMessage, ProcessStatus } from '../types/websocket'

interface EnhancedSessionStatsProps {
  messages: WSMessage[]
  processStatus: ProcessStatus
}

interface ProcessingStats {
  reviewsPerMinute: number | null
  estimatedTimeRemaining: string | null
  averageAnalysisTime: number | null
  totalProcessed: number
  batchInfo: {
    currentBatch: number
    totalBatches: number
    reviewsInBatch: number
  } | null
}

export function EnhancedSessionStats({ messages, processStatus }: EnhancedSessionStatsProps) {
  const stats = useMemo(() => {
    const now = Date.now()
    const recentMessages = messages.slice(-50) // Look at recent messages for calculations
    
    // Calculate session time
    const firstMessage = messages[0]
    const sessionStartTime = firstMessage?.timestamp ? new Date(firstMessage.timestamp).getTime() : now
    const sessionDuration = now - sessionStartTime
    
    // Initialize stats
    let reviewsPerMinute: number | null = null
    let estimatedTimeRemaining: string | null = null
    let averageAnalysisTime: number | null = null
    let totalProcessed = 0
    let batchInfo: ProcessingStats['batchInfo'] = null
    
    // Extract review processing data from messages
    const reviewEvents: Array<{ timestamp: number, count: number, type: 'scraping' | 'analysis' }> = []
    const analysisEvents: Array<{ timestamp: number, duration: number, count: number }> = []
    
    // Parse messages for review processing information
    for (const msg of recentMessages) {
      if (!msg.timestamp) continue
      
      const msgText = msg.message?.toLowerCase() || ''
      const timestamp = new Date(msg.timestamp).getTime()
      
      // Use progress messages for more accurate counting
      if (msg.type === 'progress_reviews_current' && msg.value !== undefined) {
        const type = msg.process_type === 'scraping' ? 'scraping' : 'analysis'
        reviewEvents.push({ timestamp, count: msg.value, type })
        totalProcessed = Math.max(totalProcessed, msg.value)
      }
      
      // Extract batch information from specific messages
      const batchMatch = msgText.match(/processing batch (\d+)\/(\d+)/i) || 
                         msgText.match(/batch (\d+) of (\d+)/i) ||
                         msgText.match(/batch.*?(\d+).*?\/(\d+)/i)
      if (batchMatch) {
        batchInfo = {
          currentBatch: parseInt(batchMatch[1]),
          totalBatches: parseInt(batchMatch[2]),
          reviewsInBatch: 0 // Will be updated below
        }
      }
      
      // Extract batch completion information for timing
      const batchCompletedMatch = msgText.match(/completed batch (\d+)\/(\d+) \((\d+)\/(\d+) reviews processed\)/i)
      if (batchCompletedMatch) {
        const reviewCount = parseInt(batchCompletedMatch[3])
        if (reviewCount > 0 && reviewEvents.length > 1) {
          // Calculate time between start and completion of this batch
          const batchStartIdx = reviewEvents.findIndex(e => 
            Math.abs(e.timestamp - timestamp) < 60000 && e.count < msg.value
          )
          if (batchStartIdx >= 0) {
            const duration = (timestamp - reviewEvents[batchStartIdx].timestamp) / 1000
            if (duration > 0) {
              analysisEvents.push({ timestamp, duration, count: reviewCount })
            }
          }
        }
      }
      
      // Fallback: extract timing from log messages
      const timeMatch = msgText.match(/completed.*?(\d+(?:,\d+)*)\s+reviews.*?in.*?(\d+(?:\.\d+)?)\s*(seconds?|minutes?|hours?)/i)
      if (timeMatch) {
        const reviewCount = parseInt(timeMatch[1].replace(/[^\d]/g, ''))
        let duration = parseFloat(timeMatch[2])
        const unit = timeMatch[3].toLowerCase()
        
        // Convert to seconds
        if (unit.startsWith('minute')) {
          duration *= 60
        } else if (unit.startsWith('hour')) {
          duration *= 3600
        }
        
        if (reviewCount > 0 && duration > 0) {
          analysisEvents.push({ timestamp, duration, count: reviewCount })
        }
      }
    }
    
    // Calculate reviews per minute for the current process
    if (processStatus.isRunning && reviewEvents.length >= 2) {
      const relevantEvents = reviewEvents.filter(event => 
        processStatus.processType === 'scraping' ? event.type === 'scraping' : event.type === 'analysis'
      )
      
      if (relevantEvents.length >= 2) {
        // Use the most recent events for rate calculation
        const recentEvents = relevantEvents.slice(-10) // Last 10 events for better accuracy
        
        if (recentEvents.length >= 2) {
          const startTime = recentEvents[0].timestamp
          const endTime = recentEvents[recentEvents.length - 1].timestamp
          const startCount = recentEvents[0].count
          const endCount = recentEvents[recentEvents.length - 1].count
          
          const timeSpan = endTime - startTime
          const reviewsProcessed = Math.max(0, endCount - startCount)
          
          if (timeSpan > 0 && reviewsProcessed > 0) {
            reviewsPerMinute = (reviewsProcessed / (timeSpan / 60000)) // Convert ms to minutes
          }
        }
      }
    }
    
    // Calculate average analysis time per review
    if (analysisEvents.length > 0) {
      const recentAnalysis = analysisEvents.slice(-3) // Use last 3 analysis events
      const totalTime = recentAnalysis.reduce((sum, event) => sum + event.duration, 0)
      const totalReviews = recentAnalysis.reduce((sum, event) => sum + event.count, 0)
      
      if (totalReviews > 0) {
        averageAnalysisTime = totalTime / totalReviews
      }
    }
    
    // Calculate estimated time remaining
    if (processStatus.isRunning && processStatus.progress && reviewsPerMinute && reviewsPerMinute > 0) {
      const remaining = processStatus.progress.total - processStatus.progress.current
      const minutesRemaining = remaining / reviewsPerMinute
      
      if (minutesRemaining > 0) {
        if (minutesRemaining < 1) {
          estimatedTimeRemaining = `${Math.ceil(minutesRemaining * 60)}s`
        } else if (minutesRemaining < 60) {
          estimatedTimeRemaining = `${Math.ceil(minutesRemaining)}m`
        } else {
          const hours = Math.floor(minutesRemaining / 60)
          const minutes = Math.ceil(minutesRemaining % 60)
          estimatedTimeRemaining = `${hours}h ${minutes}m`
        }
      }
    }
    
    // Handle batch processing specifics
    if (processStatus.processType === 'batch_analysis' && batchInfo) {
      // For batch analysis, estimate reviews per batch
      const avgBatchSize = batchInfo.currentBatch > 0 ? totalProcessed / batchInfo.currentBatch : 5
      batchInfo.reviewsInBatch = Math.round(avgBatchSize)
      
      // Don't override the rate calculation for batch processing - let it use the progress-based calculation
    }
    
    return {
      sessionDuration,
      reviewsPerMinute,
      estimatedTimeRemaining,
      averageAnalysisTime,
      totalProcessed,
      batchInfo
    }
  }, [messages, processStatus])
  
  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`
    } else {
      return `${seconds}s`
    }
  }
  
  const formatRate = (rate: number | null) => {
    if (rate === null) return 'Calculating...'
    if (rate < 1) return `${(rate * 60).toFixed(1)}/hr`
    return `${rate.toFixed(1)}/min`
  }
  
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Database className="h-5 w-5" />
          Session Stats
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Basic Stats */}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Session Time:</span>
            <span className="font-mono">{formatDuration(stats.sessionDuration)}</span>
          </div>
          
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Log Entries:</span>
            <span className="font-mono">{messages.length}</span>
          </div>
          
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Status:</span>
            <Badge variant="outline" className="text-xs">
              {processStatus.processType === 'idle' ? 'Ready' : processStatus.processType}
            </Badge>
          </div>
          
          {/* Processing Stats */}
          {processStatus.isRunning && (
            <>
              <hr className="my-3 border-border/50" />
              
              {processStatus.processType === 'scraping' && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      Scraping Rate:
                    </span>
                    <span className="font-mono">{formatRate(stats.reviewsPerMinute)}</span>
                  </div>
                  
                  {stats.estimatedTimeRemaining && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Est. Remaining:
                      </span>
                      <span className="font-mono">{stats.estimatedTimeRemaining}</span>
                    </div>
                  )}
                </>
              )}
              
              {(processStatus.processType === 'analysis' || processStatus.processType === 'batch_analysis') && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      Analysis Rate:
                    </span>
                    <span className="font-mono">{formatRate(stats.reviewsPerMinute)}</span>
                  </div>
                  
                  {stats.averageAnalysisTime && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Target className="h-3 w-3" />
                        Avg. Time/Review:
                      </span>
                      <span className="font-mono">
                        {stats.averageAnalysisTime < 60 
                          ? `${stats.averageAnalysisTime.toFixed(1)}s`
                          : `${(stats.averageAnalysisTime / 60).toFixed(1)}m`
                        }
                      </span>
                    </div>
                  )}
                  
                  {stats.estimatedTimeRemaining && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Est. Remaining:
                      </span>
                      <span className="font-mono">{stats.estimatedTimeRemaining}</span>
                    </div>
                  )}
                  
                  {stats.batchInfo && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Batch Progress:</span>
                      <span className="font-mono">
                        {stats.batchInfo.currentBatch}/{stats.batchInfo.totalBatches}
                      </span>
                    </div>
                  )}
                </>
              )}
              
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total Processed:</span>
                <span className="font-mono">{stats.totalProcessed.toLocaleString()}</span>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}