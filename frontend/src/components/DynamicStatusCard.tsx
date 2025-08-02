import { useState, useEffect } from 'react'
import { 
  Wifi, 
  WifiOff, 
  Brain, 
  Download, 
  Settings,
  Tag
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { WSMessage, ProcessStatus } from '../types/websocket'
import { getConfig } from '../api/ApiClient'

interface DynamicStatusCardProps {
  messages: WSMessage[]
  processStatus: ProcessStatus
  connectionState: 'connected' | 'connecting' | 'disconnected'
  onReconnect: () => void
}

interface LLMModelInfo {
  provider: string
  model: string
  tags: string[]
}

interface ScrapingSettings {
  reviews_per_app: number
  language: string
  enable_complete_scraping: boolean
}

export function DynamicStatusCard({ 
  messages, 
  processStatus, 
  connectionState, 
  onReconnect 
}: DynamicStatusCardProps) {
  const [currentModel, setCurrentModel] = useState<LLMModelInfo | null>(null)
  const [scrapingSettings, setScrapingSettings] = useState<ScrapingSettings | null>(null)
  const [loading, setLoading] = useState(false)

  const isConnected = connectionState === 'connected'

  // Load configuration when component mounts or process changes
  useEffect(() => {
    if (processStatus.processType !== 'idle') {
      loadConfiguration()
    }
  }, [processStatus.processType])

  // Extract current model from recent messages
  useEffect(() => {
    if (processStatus.processType === 'analysis' || processStatus.processType === 'batch_analysis') {
      const recentMessages = messages.slice(-20)
      
      for (let i = recentMessages.length - 1; i >= 0; i--) {
        const msg = recentMessages[i]
        if (msg.model && msg.provider) {
          // Try to get model info from config
          loadCurrentModel(msg.provider, msg.model)
          break
        }
        
        // Parse from message text as fallback
        const msgText = msg.message?.toLowerCase() || ''
        const modelMatch = msgText.match(/with\s+([a-zA-Z0-9-:._]+)/i)
        if (modelMatch) {
          // Extract provider and model from the match
          const modelString = modelMatch[1]
          const parts = modelString.split(':')
          if (parts.length >= 2) {
            loadCurrentModel(parts[0], modelString)
          }
          break
        }
      }
    }
  }, [messages, processStatus.processType])

  const loadConfiguration = async () => {
    try {
      setLoading(true)
      const response = await getConfig()
      const config = response.data
      
      // Extract scraping settings
      if (config.fetching) {
        setScrapingSettings({
          reviews_per_app: config.fetching.reviews_per_app || 100,
          language: config.fetching.language || 'all',
          enable_complete_scraping: config.fetching.enable_complete_scraping || false
        })
      }
    } catch (error) {
      console.error('Failed to load configuration:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadCurrentModel = async (provider: string, modelName: string) => {
    try {
      const response = await getConfig()
      const config = response.data
      
      if (config.llm_providers && config.llm_providers[provider]) {
        const providerConfig = config.llm_providers[provider]
        const model = providerConfig.available_models?.find(
          (m: any) => m.api_name === modelName || m.display_name === modelName
        )
        
        if (model) {
          setCurrentModel({
            provider: provider.charAt(0).toUpperCase() + provider.slice(1),
            model: model.display_name || model.api_name,
            tags: model.tags || []
          })
        } else {
          // Fallback if model not found in config
          setCurrentModel({
            provider: provider.charAt(0).toUpperCase() + provider.slice(1),
            model: modelName,
            tags: []
          })
        }
      }
    } catch (error) {
      console.error('Failed to load model info:', error)
    }
  }

  // Render content based on current state
  const renderContent = () => {
    // Idle state - show connection status
    if (processStatus.processType === 'idle') {
      return (
        <>
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
                onClick={onReconnect}
                className="mt-3"
              >
                Reconnect
              </Button>
            )}
          </CardContent>
        </>
      )
    }

    // Scraping state - show scraping settings
    if (processStatus.processType === 'scraping') {
      return (
        <>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Download className="h-5 w-5 text-green-500" />
                Scraping Settings
              </CardTitle>
              <Badge variant="secondary" className="bg-green-500/10 text-green-600">
                Active
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading settings...</p>
            ) : scrapingSettings ? (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Reviews per App:</span>
                  <span className="font-mono">{scrapingSettings.reviews_per_app.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Language:</span>
                  <span className="font-medium">{scrapingSettings.language}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Mode:</span>
                  <Badge variant="outline" className="text-xs">
                    {scrapingSettings.enable_complete_scraping ? 'Complete' : 'Limited'}
                  </Badge>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Unable to load scraping settings</p>
            )}
          </CardContent>
        </>
      )
    }

    // Analysis state - show current LLM model and tags
    if (processStatus.processType === 'analysis' || processStatus.processType === 'batch_analysis') {
      return (
        <>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Brain className="h-5 w-5 text-purple-500" />
                Active LLM Model
              </CardTitle>
              <Badge variant="secondary" className="bg-purple-500/10 text-purple-600">
                {processStatus.processType === 'batch_analysis' ? 'Batch' : 'Live'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {currentModel ? (
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Provider:</span>
                  <span className="font-medium">{currentModel.provider}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Model:</span>
                  <span className="font-mono text-xs">{currentModel.model}</span>
                </div>
                
                {currentModel.tags.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Tag className="h-3 w-3" />
                      <span>Capabilities:</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {currentModel.tags.map((tag, index) => (
                        <Badge 
                          key={index} 
                          variant="outline" 
                          className="text-xs"
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" />
                <span>Detecting active model...</span>
              </div>
            )}
          </CardContent>
        </>
      )
    }

    // Fallback
    return (
      <>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Settings className="h-5 w-5" />
            System Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Ready to start processing
          </p>
        </CardContent>
      </>
    )
  }

  return (
    <Card className="border-2 border-primary/20">
      {renderContent()}
    </Card>
  )
}