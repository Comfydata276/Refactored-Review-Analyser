// src/pages/LandingPage.tsx
import { useState } from 'react'
import { 
  BarChart3, 
  Download, 
  Wifi, 
  WifiOff,
  Activity,
  Settings,
  Clock,
  Users,
  Database,
  Square
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

import { startScrape, startAnalyse, stopProcess, getConfig, setConfig } from '../api/ApiClient'
import { useWebSocket } from '../api/WebSocketClient'
import { useProcessStatus } from '../hooks/useProcessStatus'
import { ProcessStatusCard } from '../components/ProcessStatusCard'
import { ActivityLog } from '../components/ActivityLog'
import { toast } from 'sonner'
import { useEffect } from 'react'

export default function LandingPage() {
  const { messages, connectionState, reconnect, send } = useWebSocket('/ws')
  const processStatus = useProcessStatus(messages)
  const [completeMode, setCompleteMode] = useState(false)
  const [skipScraping, setSkipScraping] = useState(false)
  const [loading, setLoading] = useState(true)

  // Load configuration on component mount
  useEffect(() => {
    loadConfiguration()
  }, [])

  const loadConfiguration = async () => {
    try {
      const response = await getConfig()
      const config = response.data
      
      // Update toggle states from backend config
      setCompleteMode(config.fetching?.enable_complete_scraping || false)
      setSkipScraping(config.analysis?.skip_scraping || false)
    } catch (error) {
      console.error('Failed to load configuration:', error)
      toast.error('Failed to load configuration')
    } finally {
      setLoading(false)
    }
  }

  const updateConfigSetting = async (path: string[], value: any) => {
    try {
      const response = await getConfig()
      const config = response.data
      
      // Update the nested config value
      const keys = path.slice()
      const lastKey = keys.pop()!
      const target = keys.reduce((obj, key) => {
        if (!obj[key]) obj[key] = {}
        return obj[key]
      }, config)
      target[lastKey] = value
      
      // Save updated config
      await setConfig(config)
    } catch (error) {
      console.error('Failed to update config:', error)
      toast.error('Failed to update configuration')
    }
  }


  const handleStartScrape = async () => {
    try {
      console.log('🔍 DEBUG: handleStartScrape called with completeMode:', completeMode)
      await startScrape(completeMode)
    } catch (error) {
      console.error('Failed to start scraping:', error)
    }
  }

  const handleStartAnalysis = async () => {
    try {
      await startAnalyse(completeMode, skipScraping)
    } catch (error) {
      console.error('Failed to start analysis:', error)
    }
  }

  const handleStop = async () => {
    try {
      await stopProcess()
    } catch (error) {
      console.error('Failed to stop process:', error)
    }
  }

  const isConnected = connectionState === 'connected'

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-3">
          <div className="p-3 rounded-full bg-primary/10 border border-primary/20">
            <Activity className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Control Dashboard
          </h1>
        </div>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Manage your Steam review analysis processes and monitor real-time progress.
        </p>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Connection Status */}
        <Card className="border-2 border-primary/20">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                {isConnected ? (
                  <Wifi className="h-5 w-5 text-green-500" />
                ) : (
                  <WifiOff className="h-5 w-5 text-red-500" />
                )}
                Connection
              </CardTitle>
              <Badge variant={isConnected ? "default" : "destructive"}>
                {connectionState}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              WebSocket status for real-time updates
            </p>
            {!isConnected && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={reconnect}
                className="mt-3"
              >
                Reconnect
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Process Status - Enhanced */}
        <ProcessStatusCard 
          status={processStatus}
          onStop={handleStop}
        />

        {/* Statistics Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Database className="h-5 w-5" />
              Session Stats
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Log Entries:</span>
                <span className="font-mono">{messages.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Session Time:</span>
                <span className="font-mono">
                  {messages.length > 0 ? '45m 12s' : '0s'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Status:</span>
                <Badge variant="outline" className="text-xs">
                  {processStatus.processType === 'idle' ? 'Ready' : processStatus.processType}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Control Panel */}
      <Card className="border-2 border-primary/20 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Process Control
          </CardTitle>
          <CardDescription>
            Configure and manage your analysis processes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Configuration Options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                <div className="space-y-1">
                  <div className="font-medium">Complete Scraping Mode</div>
                  <div className="text-sm text-muted-foreground">
                    Perform comprehensive data collection
                  </div>
                </div>
                <Switch
                  checked={completeMode}
                  onCheckedChange={async (checked) => {
                    setCompleteMode(checked)
                    await updateConfigSetting(['fetching', 'enable_complete_scraping'], checked)
                    toast.success(`Complete scraping mode ${checked ? 'enabled' : 'disabled'}`)
                  }}
                  disabled={processStatus.isRunning || loading}
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                <div className="space-y-1">
                  <div className="font-medium">Skip Scraping</div>
                  <div className="text-sm text-muted-foreground">
                    Run analysis on existing data only
                  </div>
                </div>
                <Switch
                  checked={skipScraping}
                  onCheckedChange={async (checked) => {
                    setSkipScraping(checked)
                    await updateConfigSetting(['analysis', 'skip_scraping'], checked)
                    toast.success(`Skip scraping ${checked ? 'enabled' : 'disabled'}`)
                  }}
                  disabled={processStatus.isRunning || loading}
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-4">
              <Button
                onClick={handleStartScrape}
                disabled={processStatus.isRunning}
                className={cn(
                  "w-full h-14 text-base border-2 transition-all duration-300",
                  processStatus.processType === 'scraping' && processStatus.isRunning
                    ? "bg-green-500/10 border-green-500/30 text-green-600"
                    : processStatus.processType === 'scraping' && !processStatus.isRunning
                    ? "bg-green-500/5 border-green-500/20 text-green-700 hover:bg-green-500/10"
                    : "steam-gradient hover:opacity-90"
                )}
                size="lg"
              >
                <Download className="h-5 w-5 mr-2" />
                {processStatus.processType === 'scraping' && processStatus.isRunning 
                  ? 'Scraping In Progress...'
                  : processStatus.processType === 'scraping' && !processStatus.isRunning
                  ? '✓ Scraping Complete'
                  : 'Start Scraping Process'
                }
              </Button>

              <Button
                onClick={handleStartAnalysis}
                disabled={processStatus.isRunning}
                variant="outline"
                className={cn(
                  "w-full h-14 text-base border-2 transition-all duration-300",
                  (processStatus.processType === 'analysis' || processStatus.processType === 'batch_analysis') && processStatus.isRunning
                    ? processStatus.processType === 'batch_analysis' 
                      ? "bg-orange-500/10 border-orange-500/30 text-orange-600"
                      : "bg-purple-500/10 border-purple-500/30 text-purple-600"
                    : (processStatus.processType === 'analysis' || processStatus.processType === 'batch_analysis') && !processStatus.isRunning
                    ? processStatus.processType === 'batch_analysis'
                      ? "bg-orange-500/5 border-orange-500/20 text-orange-700 hover:bg-orange-500/10"
                      : "bg-purple-500/5 border-purple-500/20 text-purple-700 hover:bg-purple-500/10"
                    : ""
                )}
                size="lg"
              >
                <BarChart3 className="h-5 w-5 mr-2" />
                {(processStatus.processType === 'analysis' || processStatus.processType === 'batch_analysis') && processStatus.isRunning 
                  ? processStatus.processType === 'batch_analysis' 
                    ? 'Batch Analysis In Progress...'
                    : 'Analysis In Progress...'
                  : (processStatus.processType === 'analysis' || processStatus.processType === 'batch_analysis') && !processStatus.isRunning
                  ? processStatus.processType === 'batch_analysis'
                    ? '✓ Batch Analysis Complete'
                    : '✓ Analysis Complete'
                  : 'Start Analysis Process'
                }
              </Button>

              {/* CRITICAL: Stop Process Button */}
              <Button
                onClick={handleStop}
                disabled={!processStatus.isRunning}
                variant="destructive"
                className="w-full h-12 text-base"
                size="lg"
              >
                <Square className="h-4 w-4 mr-2" />
                Stop Current Process
              </Button>
            </div>
          </div>

          {/* Running Process Info */}
          {processStatus.isRunning && (
            <div className={cn(
              "p-4 rounded-lg border transition-all duration-300",
              processStatus.processType === 'scraping' 
                ? "bg-green-500/10 border-green-500/20" 
                : processStatus.processType === 'analysis'
                ? "bg-purple-500/10 border-purple-500/20"
                : processStatus.processType === 'batch_analysis'
                ? "bg-orange-500/10 border-orange-500/20"
                : "bg-primary/10 border-primary/20"
            )}>
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent opacity-70" />
                <div className="flex-1">
                  <p className="font-medium">
                    {processStatus.processType === 'scraping' ? 'Scraping Reviews' : 
                     processStatus.processType === 'batch_analysis' ? 'Batch Analysis' : 'Analyzing Data'}
                  </p>
                  <p className="text-sm opacity-70 mt-1">
                    {processStatus.currentItem || 'Monitor detailed progress in the activity log below'}
                  </p>
                </div>
              </div>
              {processStatus.progress && (
                <div className="mt-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>{processStatus.progress.current} of {processStatus.progress.total}</span>
                    <span>{processStatus.progress.percentage.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-black/20 rounded-full h-2">
                    <div 
                      className="bg-current h-2 rounded-full transition-all duration-300"
                      style={{ width: `${processStatus.progress.percentage}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Enhanced Activity Log */}
      <Card className="border border-border/50">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Real-time Activity Log
          </CardTitle>
          <CardDescription>
            Live updates from the analysis engine with detailed progress tracking
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ActivityLog 
            messages={messages}
            isConnected={isConnected}
            maxHeight="h-96"
          />
        </CardContent>
      </Card>

    </div>
  )
}