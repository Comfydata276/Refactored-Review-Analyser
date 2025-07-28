// src/pages/SettingsPage.tsx
import { useEffect, useState } from 'react'
import { Save, RotateCcw, Settings, Database, Zap, Shield, Gamepad2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { getConfig, setConfig } from '../api/ApiClient'

interface FullConfig { 
  [key: string]: any
  app_ids?: number[]
  llm_provider?: string
  api_key?: string
  model_name?: string
  max_reviews?: number
  enable_caching?: boolean
  debug_mode?: boolean
}

export default function SettingsPage() {
  const [cfg, setCfg] = useState<FullConfig | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getConfig()
      .then(r => {
        setCfg(r.data)
        setLoading(false)
      })
      .catch(error => {
        console.error('Failed to load config:', error)
        toast.error('Failed to load configuration')
        setLoading(false)
      })
  }, [])

  const onFieldChange = (path: string, value: any) => {
    if (!cfg) return
    
    const next = JSON.parse(JSON.stringify(cfg))
    const keys = path.split('.')
    const lastKey = keys.pop()!
    
    const target = keys.reduce((obj, key) => {
      if (!obj[key]) obj[key] = {}
      return obj[key]
    }, next)
    
    target[lastKey] = value
    setCfg(next)
    setDirty(true)
  }

  const handleSave = async () => {
    if (!cfg || !dirty) return
    
    setSaving(true)
    try {
      await setConfig(cfg)
      setDirty(false)
      toast.success('Configuration saved successfully!')
    } catch (error) {
      console.error('Failed to save config:', error)
      toast.error('Failed to save configuration')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    if (!cfg) return
    
    // Reset to default values
    const defaults: FullConfig = {
      app_ids: [],
      llm_provider: 'openai',
      model_name: 'gpt-3.5-turbo',
      max_reviews: 100,
      enable_caching: true,
      debug_mode: false
    }
    
    setCfg({ ...cfg, ...defaults })
    setDirty(true)
    toast.info('Configuration reset to defaults')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="space-y-4 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mx-auto" />
          <p className="text-muted-foreground">Loading configuration...</p>
        </div>
      </div>
    )
  }

  if (!cfg) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center space-y-4">
          <Shield className="h-12 w-12 text-muted-foreground mx-auto" />
          <div>
            <h3 className="text-lg font-semibold">Configuration Error</h3>
            <p className="text-muted-foreground">Unable to load application settings</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full bg-primary/10 border border-primary/20">
              <Settings className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Application Settings
            </h1>
          </div>
          <p className="text-lg text-muted-foreground">
            Configure your Steam review analysis parameters and preferences.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          {dirty && (
            <Badge variant="secondary" className="px-3 py-1">
              Unsaved changes
            </Badge>
          )}
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={saving}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <Button
            onClick={handleSave}
            disabled={!dirty || saving}
            className="steam-gradient hover:opacity-90"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Game Configuration */}
        <Card className="border-2 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gamepad2 className="h-5 w-5" />
              Game Configuration
            </CardTitle>
            <CardDescription>
              Manage the Steam games in your analysis collection
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label htmlFor="app_ids">Selected Games</Label>
              <div className="p-4 rounded-lg border bg-muted/20 min-h-20">
                {cfg.app_ids && cfg.app_ids.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {cfg.app_ids.map((appId: number) => (
                      <Badge key={appId} variant="secondary" className="px-3 py-1">
                        App ID: {appId}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No games selected. Use the Game Finder to add games to your collection.
                  </p>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Games can be added using the Game Finder page
              </p>
            </div>

            <div className="space-y-3">
              <Label htmlFor="max_reviews">Maximum Reviews per Game</Label>
              <Input
                id="max_reviews"
                type="number"
                value={cfg.max_reviews || 100}
                onChange={(e) => onFieldChange('max_reviews', parseInt(e.target.value) || 100)}
                min="1"
                max="10000"
              />
              <p className="text-xs text-muted-foreground">
                Limit the number of reviews to analyze per game (1-10,000)
              </p>
            </div>
          </CardContent>
        </Card>

        {/* AI Configuration */}
        <Card className="border-2 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              AI Analysis Settings
            </CardTitle>
            <CardDescription>
              Configure the language model for review analysis
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label htmlFor="llm_provider">LLM Provider</Label>
              <Select
                value={cfg.llm_provider || 'openai'}
                onValueChange={(value) => onFieldChange('llm_provider', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="anthropic">Anthropic</SelectItem>
                  <SelectItem value="local">Local Model</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label htmlFor="model_name">Model Name</Label>
              <Input
                id="model_name"
                value={cfg.model_name || ''}
                onChange={(e) => onFieldChange('model_name', e.target.value)}
                placeholder="e.g., gpt-3.5-turbo, claude-3-sonnet"
              />
              <p className="text-xs text-muted-foreground">
                Specify the exact model name to use for analysis
              </p>
            </div>

            <div className="space-y-3">
              <Label htmlFor="api_key">API Key</Label>
              <Input
                id="api_key"
                type="password"
                value={cfg.api_key || ''}
                onChange={(e) => onFieldChange('api_key', e.target.value)}
                placeholder="Enter your API key"
              />
              <p className="text-xs text-muted-foreground">
                Your API key is stored securely and never transmitted in logs
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Performance Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Performance & Caching
            </CardTitle>
            <CardDescription>
              Optimize analysis speed and resource usage
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
              <div className="space-y-1">
                <div className="font-medium">Enable Caching</div>
                <div className="text-sm text-muted-foreground">
                  Cache API responses to improve performance
                </div>
              </div>
              <Switch
                checked={cfg.enable_caching || false}
                onCheckedChange={(checked) => onFieldChange('enable_caching', checked)}
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
              <div className="space-y-1">
                <div className="font-medium">Debug Mode</div>
                <div className="text-sm text-muted-foreground">
                  Enable detailed logging for troubleshooting
                </div>
              </div>
              <Switch
                checked={cfg.debug_mode || false}
                onCheckedChange={(checked) => onFieldChange('debug_mode', checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* System Information */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              System Information
            </CardTitle>
            <CardDescription>
              Current application status and diagnostics
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Games Selected:</span>
                <div className="font-medium">{cfg.app_ids?.length || 0}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Provider:</span>
                <div className="font-medium capitalize">{cfg.llm_provider || 'Not set'}</div>
              </div>
              <div>
                <span className="text-muted-foreground">Caching:</span>
                <div className="font-medium">
                  {cfg.enable_caching ? 'Enabled' : 'Disabled'}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Debug:</span>
                <div className="font-medium">
                  {cfg.debug_mode ? 'Enabled' : 'Disabled'}
                </div>
              </div>
            </div>

            <Separator />

            <div className="text-xs text-muted-foreground space-y-1">
              <p>Configuration is automatically saved to the backend.</p>
              <p>Changes take effect immediately for new analysis runs.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}