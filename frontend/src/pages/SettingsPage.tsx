// src/pages/SettingsPage.tsx
import { useEffect, useState } from 'react'
import { Save, RotateCcw, Settings, Database, Zap, Shield } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { getConfig, setConfig } from '../api/ApiClient'
import { useUnsavedChanges } from '../hooks/useUnsavedChanges'
import { UnsavedChangesDialog } from '../components/UnsavedChangesDialog'
import { useAccordionState } from '../contexts/DropdownStateContext'

interface FullConfig { 
  [key: string]: any
  app_ids?: number[]
  selected_apps?: Array<{appid: number, name: string}>
  debug_mode?: boolean
  analysis?: {
    reviews_to_analyze?: number
    api_retries?: number
    api_retry_delay?: number
    api_batch_size?: number
    enable_resume?: boolean
  }
  fetching?: {
    reviews_per_app?: number
    language?: string
    scraping_timeout?: number
  }
  filtering?: {
    min_review_length?: number
    min_playtime_hours?: number
  }
  advanced_filtering?: {
    min_votes_up?: number
    early_access_only?: boolean
    verified_purchase_only?: boolean
  }
  validation?: {
    validate_app_ids?: boolean
    validate_models?: boolean
  }
}

export default function SettingsPage() {
  const [cfg, setCfg] = useState<FullConfig | null>(null)
  const [originalCfg, setOriginalCfg] = useState<FullConfig | null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getConfig()
      .then(r => {
        setCfg(r.data)
        setOriginalCfg(JSON.parse(JSON.stringify(r.data)))
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
      setOriginalCfg(JSON.parse(JSON.stringify(cfg)))
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
    
    // Reset to default values matching backend config structure
    const defaults: FullConfig = {
      app_ids: [],
      selected_apps: [],
      debug_mode: false,
      analysis: {
        reviews_to_analyze: 2,
        api_retries: 3,
        api_retry_delay: 1,
        api_batch_size: 1,
        enable_resume: true
      },
      fetching: {
        reviews_per_app: 100,
        language: 'all',
        scraping_timeout: 3600
      },
      filtering: {
        min_review_length: 50,
        min_playtime_hours: 0
      },
      advanced_filtering: {
        min_votes_up: 0,
        early_access_only: false,
        verified_purchase_only: false
      },
      validation: {
        validate_app_ids: true,
        validate_models: true
      }
    }
    
    setCfg({ ...cfg, ...defaults })
    setDirty(true)
    toast.info('Configuration reset to defaults')
  }

  const handleDiscard = () => {
    if (originalCfg) {
      setCfg(JSON.parse(JSON.stringify(originalCfg)))
      setDirty(false)
    }
  }

  // Use the unsaved changes hook
  const unsavedChanges = useUnsavedChanges({
    hasUnsavedChanges: dirty,
    onSave: handleSave,
    onDiscard: handleDiscard
  })

  // Use accordion state hooks for persistent dropdown states
  const leftAccordionState = useAccordionState('settings-left-accordion', ['analysis', 'filtering'])
  const rightAccordionState = useAccordionState('settings-right-accordion', ['fetching', 'validation'])

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
    <>
      <UnsavedChangesDialog
        open={unsavedChanges.isBlocked}
        onSave={unsavedChanges.save}
        onDiscard={unsavedChanges.discard}
        onCancel={unsavedChanges.reset}
        saving={saving}
      />
      
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
        {/* Left Column */}
        <div className="space-y-6">
          <Accordion 
            type="multiple" 
            value={leftAccordionState.value}
            onValueChange={leftAccordionState.onValueChange}
            className="w-full space-y-4"
          >
            {/* Analysis Configuration */}
            <AccordionItem value="analysis" className="border-2 border-primary/20 rounded-lg px-6">
          <AccordionTrigger className="py-6 hover:no-underline">
            <div className="flex items-center gap-3 flex-1 pointer-events-none">
              <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                <Zap className="h-5 w-5 text-primary" />
              </div>
              <div className="text-left">
                <h3 className="text-lg font-semibold">Analysis Configuration</h3>
                <p className="text-sm text-muted-foreground">Configure analysis parameters and retry policies</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-6 pb-6">
            <div className="space-y-3">
              <Label htmlFor="reviews_to_analyze">Reviews to Analyze</Label>
              <Input
                id="reviews_to_analyze"
                type="number"
                value={cfg.analysis?.reviews_to_analyze || 2}
                onChange={(e) => onFieldChange('analysis.reviews_to_analyze', parseInt(e.target.value) || 2)}
                min="1"
                max="1000"
              />
              <p className="text-xs text-muted-foreground">
                Number of reviews to analyze per batch
              </p>
            </div>

            <div className="space-y-3">
              <Label htmlFor="api_retries">API Retries</Label>
              <Input
                id="api_retries"
                type="number"
                value={cfg.analysis?.api_retries || 3}
                onChange={(e) => onFieldChange('analysis.api_retries', parseInt(e.target.value) || 3)}
                min="1"
                max="10"
              />
              <p className="text-xs text-muted-foreground">
                Number of retries for failed API calls
              </p>
            </div>

            <div className="space-y-3">
              <Label htmlFor="api_retry_delay">API Retry Delay (seconds)</Label>
              <Input
                id="api_retry_delay"
                type="number"
                value={cfg.analysis?.api_retry_delay || 1}
                onChange={(e) => onFieldChange('analysis.api_retry_delay', parseInt(e.target.value) || 1)}
                min="1"
                max="60"
              />
              <p className="text-xs text-muted-foreground">
                Delay between API retry attempts
              </p>
            </div>

            <div className="space-y-3">
              <Label htmlFor="api_batch_size">Reviews per Batch</Label>
              <Input
                id="api_batch_size"
                type="number"
                value={cfg.analysis?.api_batch_size || 1}
                onChange={(e) => onFieldChange('analysis.api_batch_size', parseInt(e.target.value) || 1)}
                min="1"
                max="100"
              />
              <p className="text-xs text-muted-foreground">
                Number of reviews to process in each batch call to the LLM
              </p>
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
              <div className="space-y-1">
                <div className="font-medium">Enable Resume</div>
                <div className="text-sm text-muted-foreground">
                  Resume incomplete analysis sessions
                </div>
              </div>
              <Switch
                checked={cfg.analysis?.enable_resume || true}
                onCheckedChange={(checked) => onFieldChange('analysis.enable_resume', checked)}
              />
            </div>
          </AccordionContent>
        </AccordionItem>

            {/* Review Filtering */}
            <AccordionItem value="filtering" className="border rounded-lg px-6">
              <AccordionTrigger className="py-6 hover:no-underline">
                <div className="flex items-center gap-3 flex-1 pointer-events-none">
                  <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                    <Shield className="h-5 w-5 text-primary" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-lg font-semibold">Review Filtering</h3>
                    <p className="text-sm text-muted-foreground">Filter reviews by quality and content criteria</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-6 pb-6">
                <div className="space-y-3">
                  <Label htmlFor="min_review_length">Minimum Review Length</Label>
                  <Input
                    id="min_review_length"
                    type="number"
                    value={cfg.filtering?.min_review_length || 50}
                    onChange={(e) => onFieldChange('filtering.min_review_length', parseInt(e.target.value) || 50)}
                    min="1"
                    max="1000"
                  />
                  <p className="text-xs text-muted-foreground">
                    Minimum character length for reviews
                  </p>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="min_playtime_hours">Minimum Playtime (hours)</Label>
                  <Input
                    id="min_playtime_hours"
                    type="number"
                    value={cfg.filtering?.min_playtime_hours || 0}
                    onChange={(e) => onFieldChange('filtering.min_playtime_hours', parseInt(e.target.value) || 0)}
                    min="0"
                    max="10000"
                  />
                  <p className="text-xs text-muted-foreground">
                    Minimum playtime required for review inclusion
                  </p>
                </div>

                <div className="space-y-3">
                  <Label htmlFor="min_votes_up">Minimum Helpful Votes</Label>
                  <Input
                    id="min_votes_up"
                    type="number"
                    value={cfg.advanced_filtering?.min_votes_up || 0}
                    onChange={(e) => onFieldChange('advanced_filtering.min_votes_up', parseInt(e.target.value) || 0)}
                    min="0"
                    max="1000"
                  />
                  <p className="text-xs text-muted-foreground">
                    Minimum number of helpful votes required
                  </p>
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                  <div className="space-y-1">
                    <div className="font-medium">Early Access Only</div>
                    <div className="text-sm text-muted-foreground">
                      Include only Early Access reviews
                    </div>
                  </div>
                  <Switch
                    checked={cfg.advanced_filtering?.early_access_only || false}
                    onCheckedChange={(checked) => onFieldChange('advanced_filtering.early_access_only', checked)}
                  />
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                  <div className="space-y-1">
                    <div className="font-medium">Verified Purchase Only</div>
                    <div className="text-sm text-muted-foreground">
                      Include only verified purchase reviews
                    </div>
                  </div>
                  <Switch
                    checked={cfg.advanced_filtering?.verified_purchase_only || false}
                    onCheckedChange={(checked) => onFieldChange('advanced_filtering.verified_purchase_only', checked)}
                  />
                </div>
              </AccordionContent>
            </AccordionItem>

          </Accordion>
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          <Accordion 
            type="multiple" 
            value={rightAccordionState.value}
            onValueChange={rightAccordionState.onValueChange}
            className="w-full space-y-4"
          >
            {/* Fetching Configuration */}
            <AccordionItem value="fetching" className="border-2 border-primary/20 rounded-lg px-6">
          <AccordionTrigger className="py-6 hover:no-underline">
            <div className="flex items-center gap-3 flex-1 pointer-events-none">
              <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                <Database className="h-5 w-5 text-primary" />
              </div>
              <div className="text-left">
                <h3 className="text-lg font-semibold">Review Fetching Settings</h3>
                <p className="text-sm text-muted-foreground">Configure how reviews are scraped from Steam</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-6 pb-6">
            <div className="space-y-3">
              <Label htmlFor="reviews_per_app">Reviews per App</Label>
              <Input
                id="reviews_per_app"
                type="number"
                value={cfg.fetching?.reviews_per_app || 100}
                onChange={(e) => onFieldChange('fetching.reviews_per_app', parseInt(e.target.value) || 100)}
                min="10"
                max="10000"
              />
              <p className="text-xs text-muted-foreground">
                Maximum number of reviews to fetch per game
              </p>
            </div>

            <div className="space-y-3">
              <Label htmlFor="language">Language Filter</Label>
              <Select
                value={cfg.fetching?.language || 'all'}
                onValueChange={(value) => onFieldChange('fetching.language', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Languages</SelectItem>
                  <SelectItem value="english">English Only</SelectItem>
                  <SelectItem value="spanish">Spanish Only</SelectItem>
                  <SelectItem value="french">French Only</SelectItem>
                  <SelectItem value="german">German Only</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Filter reviews by language
              </p>
            </div>

            <div className="space-y-3">
              <Label htmlFor="scraping_timeout">Scraping Timeout (seconds)</Label>
              <Input
                id="scraping_timeout"
                type="number"
                value={cfg.fetching?.scraping_timeout || 3600}
                onChange={(e) => onFieldChange('fetching.scraping_timeout', parseInt(e.target.value) || 3600)}
                min="60"
                max="7200"
              />
              <p className="text-xs text-muted-foreground">
                Maximum time to spend scraping reviews
              </p>
            </div>
          </AccordionContent>
        </AccordionItem>

            {/* Validation Settings */}
            <AccordionItem value="validation" className="border rounded-lg px-6">
              <AccordionTrigger className="py-6 hover:no-underline">
                <div className="flex items-center gap-3 flex-1 pointer-events-none">
                  <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                    <Shield className="h-5 w-5 text-primary" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-lg font-semibold">Validation Settings</h3>
                    <p className="text-sm text-muted-foreground">Enable validation checks for configuration and data</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-6 pb-6">
                <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                  <div className="space-y-1">
                    <div className="font-medium">Validate App IDs</div>
                    <div className="text-sm text-muted-foreground">
                      Check if game IDs exist on Steam
                    </div>
                  </div>
                  <Switch
                    checked={cfg.validation?.validate_app_ids || true}
                    onCheckedChange={(checked) => onFieldChange('validation.validate_app_ids', checked)}
                  />
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                  <div className="space-y-1">
                    <div className="font-medium">Validate Models</div>
                    <div className="text-sm text-muted-foreground">
                      Verify LLM models are available
                    </div>
                  </div>
                  <Switch
                    checked={cfg.validation?.validate_models || true}
                    onCheckedChange={(checked) => onFieldChange('validation.validate_models', checked)}
                  />
                </div>
              </AccordionContent>
            </AccordionItem>
            {/* Storage & Paths */}
            <AccordionItem value="storage" className="border rounded-lg px-6">
              <AccordionTrigger className="py-6 hover:no-underline">
                <div className="flex items-center gap-3 flex-1 pointer-events-none">
                  <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                    <Database className="h-5 w-5 text-primary" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-lg font-semibold">Storage & Paths</h3>
                    <p className="text-sm text-muted-foreground">Configure output folders used for saving results</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-6 pb-6">
                <div className="space-y-3">
                  <Label htmlFor="raw_output_folder">Raw Output Folder</Label>
                  <Input
                    id="raw_output_folder"
                    type="text"
                    value={cfg.file_paths?.raw_output_folder ?? 'output/raw'}
                    onChange={(e) => onFieldChange('file_paths.raw_output_folder', e.target.value)}
                  />
                </div>
                <div className="space-y-3">
                  <Label htmlFor="analysed_output_folder">Analysed Output Folder</Label>
                  <Input
                    id="analysed_output_folder"
                    type="text"
                    value={cfg.file_paths?.analysed_output_folder ?? 'output/analysed'}
                    onChange={(e) => onFieldChange('file_paths.analysed_output_folder', e.target.value)}
                  />
                </div>
                <div className="space-y-3">
                  <Label htmlFor="summary_output_folder">Summary Output Folder</Label>
                  <Input
                    id="summary_output_folder"
                    type="text"
                    value={cfg.file_paths?.summary_output_folder ?? 'output/summary'}
                    onChange={(e) => onFieldChange('file_paths.summary_output_folder', e.target.value)}
                  />
                </div>
              </AccordionContent>
            </AccordionItem>

          </Accordion>
        </div>
      </div>
    </div>
    </>
  )
}