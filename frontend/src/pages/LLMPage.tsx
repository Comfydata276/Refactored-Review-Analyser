// src/pages/LLMPage.tsx
import { useEffect, useState } from 'react'
import { 
  Save, 
  RotateCcw, 
  Zap, 
  Plus, 
  Edit, 
  Trash2, 
  Eye, 
  EyeOff, 
  Server,
  Globe,
  Brain
} from 'lucide-react'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

import { getConfig, setConfig, refreshOllamaModels, getApiKeys, setApiKey, removeApiKey } from '../api/ApiClient'

interface ModelConfig {
  display_name: string
  api_name: string
  tags: string[]
  reasoning_level?: 'low' | 'medium' | 'high'
  enabled: boolean
}

interface ProviderConfig {
  enabled: boolean
  api_key?: string
  available_models: ModelConfig[]
  enabled_models: string[]
}

interface LLMConfig {
  llm_providers: {
    ollama?: ProviderConfig
    openai?: ProviderConfig
    gemini?: ProviderConfig
    claude?: ProviderConfig
  }
}

export default function LLMPage() {
  const [config, setConfigState] = useState<LLMConfig | null>(null)
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [editingModel, setEditingModel] = useState<{
    provider: string
    model?: ModelConfig
    index?: number
  } | null>(null)
  const [showApiKey, setShowApiKey] = useState<Record<string, boolean>>({})
  const [refreshingOllama, setRefreshingOllama] = useState(false)

  useEffect(() => {
    loadConfig()
  }, [])

  const loadConfig = async () => {
    try {
      // Load both config and API keys in parallel
      const [configResponse, apiKeysResponse] = await Promise.all([
        getConfig(),
        getApiKeys()
      ])
      
      setConfigState(configResponse.data)
      
      if (apiKeysResponse.data.status === 'success') {
        setApiKeys(apiKeysResponse.data.api_keys || {})
      }
      
      setLoading(false)
    } catch (error) {
      console.error('Failed to load config:', error)
      toast.error('Failed to load LLM configuration')
      setLoading(false)
    }
  }

  const autoSave = async (newConfig: LLMConfig) => {
    setSaving(true)
    try {
      await setConfig(newConfig)
      toast.success('Configuration saved automatically!')
    } catch (error) {
      console.error('Failed to auto-save config:', error)
      toast.error('Failed to save configuration')
    } finally {
      setSaving(false)
    }
  }

  const handleSave = async () => {
    if (!config) return
    
    setSaving(true)
    try {
      await setConfig(config)
      toast.success('LLM configuration saved successfully!')
    } catch (error) {
      console.error('Failed to save config:', error)
      toast.error('Failed to save LLM configuration')
    } finally {
      setSaving(false)
    }
  }

  const updateProvider = async (provider: string, updates: Partial<ProviderConfig>) => {
    if (!config) return
    
    console.log(`Updating provider ${provider} with:`, updates)
    
    // Handle API key updates separately for security
    if ('api_key' in updates) {
      await handleApiKeyUpdate(provider, updates.api_key || '')
      // Remove api_key from updates to prevent it from being saved to config
      const { api_key, ...otherUpdates } = updates
      updates = otherUpdates
    }
    
    // Only proceed with other updates if there are any
    if (Object.keys(updates).length > 0) {
      const newConfig = {
        ...config,
        llm_providers: {
          ...config.llm_providers,
          [provider]: {
            ...config.llm_providers[provider as keyof typeof config.llm_providers],
            ...updates
          }
        }
      }
      console.log(`New config for ${provider}:`, newConfig.llm_providers[provider as keyof typeof newConfig.llm_providers])
      setConfigState(newConfig)
      await autoSave(newConfig)
    }
  }

  const handleApiKeyUpdate = async (provider: string, newApiKey: string) => {
    setSaving(true)
    try {
      if (newApiKey.trim()) {
        // Set the API key securely
        await setApiKey(provider, newApiKey)
        setApiKeys(prev => ({ ...prev, [provider]: newApiKey }))
        toast.success(`API key for ${provider} saved securely!`)
      } else {
        // Remove the API key
        await removeApiKey(provider)
        setApiKeys(prev => {
          const updated = { ...prev }
          delete updated[provider]
          return updated
        })
        toast.success(`API key for ${provider} removed!`)
      }
    } catch (error: any) {
      console.error('Failed to update API key:', error)
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to update API key'
      toast.error(errorMessage)
    } finally {
      setSaving(false)
    }
  }

  const toggleProvider = (provider: string, enabled: boolean) => {
    updateProvider(provider, { enabled })
  }

  const toggleModel = (provider: string, modelApiName: string, enabled: boolean) => {
    if (!config?.llm_providers) return
    
    const providerConfig = config.llm_providers[provider as keyof typeof config.llm_providers]
    if (!providerConfig) return

    // Find the model to get both display_name and api_name
    const model = providerConfig.available_models?.find(m => m.api_name === modelApiName)
    if (!model) return

    const currentEnabledModels = providerConfig.enabled_models || []
    
    let enabledModels: string[]
    if (enabled) {
      // Add the api_name to enabled models (if not already present)
      enabledModels = currentEnabledModels.includes(modelApiName) 
        ? currentEnabledModels 
        : [...currentEnabledModels, modelApiName]
    } else {
      // Remove both display_name and api_name from enabled models
      enabledModels = currentEnabledModels.filter(name => 
        name !== modelApiName && name !== model.display_name
      )
    }

    updateProvider(provider, { enabled_models: enabledModels })
  }

  const addOrUpdateModel = async (provider: string, model: ModelConfig, index?: number) => {
    if (!config?.llm_providers) return
    
    const providerConfig = config.llm_providers[provider as keyof typeof config.llm_providers]
    if (!providerConfig) return

    const models = [...(providerConfig.available_models || [])]
    
    if (index !== undefined) {
      models[index] = model
    } else {
      models.push(model)
    }

    await updateProvider(provider, { available_models: models })
    setEditingModel(null)
  }

  const deleteModel = async (provider: string, index: number) => {
    if (!config?.llm_providers) return
    
    const providerConfig = config.llm_providers[provider as keyof typeof config.llm_providers]
    if (!providerConfig) return

    const models = [...(providerConfig.available_models || [])]
    const deletedModel = models[index]
    models.splice(index, 1)

    // Remove both display_name and api_name from enabled models
    const enabledModels = (providerConfig.enabled_models || [])
      .filter(name => name !== deletedModel.api_name && name !== deletedModel.display_name)

    await updateProvider(provider, { 
      available_models: models,
      enabled_models: enabledModels
    })
  }

  const handleRefreshOllama = async () => {
    setRefreshingOllama(true)
    try {
      // Call the backend to refresh Ollama models
      const response = await refreshOllamaModels()
      const result = response.data
      
      if (result.status === 'success') {
        // Reload the config to get the updated models
        await loadConfig()
        toast.success(`Ollama models refreshed successfully! Found ${result.models?.length || 0} models.`)
      } else {
        toast.error(result.message || 'Failed to refresh Ollama models')
      }
    } catch (error: any) {
      console.error('Failed to refresh Ollama models:', error)
      const errorMessage = error.response?.data?.detail || error.message || 'Failed to refresh Ollama models'
      toast.error(errorMessage)
    } finally {
      setRefreshingOllama(false)
    }
  }

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'ollama': return <Server className="h-5 w-5" />
      case 'openai': case 'gemini': case 'claude': return <Globe className="h-5 w-5" />
      default: return <Brain className="h-5 w-5" />
    }
  }

  const getProviderTitle = (provider: string) => {
    switch (provider) {
      case 'ollama': return 'Ollama - Local Models'
      case 'openai': return 'OpenAI'
      case 'gemini': return 'Google Gemini'
      case 'claude': return 'Anthropic Claude'
      default: return provider
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="space-y-4 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mx-auto" />
          <p className="text-muted-foreground">Loading LLM configuration...</p>
        </div>
      </div>
    )
  }

  if (!config) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center space-y-4">
          <Zap className="h-12 w-12 text-muted-foreground mx-auto" />
          <div>
            <h3 className="text-lg font-semibold">Configuration Error</h3>
            <p className="text-muted-foreground">Unable to load LLM settings</p>
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
              <Zap className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              LLM Model Management
            </h1>
          </div>
          <p className="text-lg text-muted-foreground">
            Configure and manage AI language models for review analysis.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          {saving && (
            <Badge variant="secondary" className="px-3 py-1">
              <div className="animate-spin rounded-full h-3 w-3 border-2 border-current border-t-transparent mr-2" />
              Auto-saving...
            </Badge>
          )}
          <Button
            variant="outline"
            onClick={loadConfig}
            disabled={saving}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Provider Sections */}
      <Accordion type="multiple" defaultValue={["ollama", "openai", "gemini", "claude"]} className="w-full space-y-4">
        {Object.entries(config.llm_providers || {}).map(([provider, providerConfig]) => (
          <AccordionItem key={provider} value={provider} className="border-2 border-primary/20 rounded-lg px-6">
            <AccordionTrigger className="py-6">
              <div className="flex items-center justify-between w-full mr-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
                    {getProviderIcon(provider)}
                  </div>
                  <div className="text-left">
                    <h3 className="text-lg font-semibold">{getProviderTitle(provider)}</h3>
                    <p className="text-sm text-muted-foreground">
                      {providerConfig?.available_models?.length || 0} models available
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <Switch
                    checked={providerConfig?.enabled || false}
                    onCheckedChange={(checked) => toggleProvider(provider, checked)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
            </AccordionTrigger>
            
            <AccordionContent className="space-y-6 pb-6">
              {/* API Key for cloud providers */}
              {provider !== 'ollama' && (
                <div className="space-y-3">
                  <Label htmlFor={`${provider}-api-key`}>API Key</Label>
                  <div className="flex gap-2">
                    <Input
                      id={`${provider}-api-key`}
                      type={showApiKey[provider] ? "text" : "password"}
                      value={apiKeys[provider] || ''}
                      onChange={(e) => updateProvider(provider, { api_key: e.target.value })}
                      placeholder="Enter your API key"
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setShowApiKey(prev => ({ ...prev, [provider]: !prev[provider] }))}
                    >
                      {showApiKey[provider] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Your API key is stored securely and never transmitted in logs
                  </p>
                </div>
              )}

              {/* Models List */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Available Models</Label>
                  {provider === 'ollama' ? (
                    <Button
                      size="sm"
                      onClick={handleRefreshOllama}
                      disabled={refreshingOllama}
                      className="h-8"
                    >
                      {refreshingOllama ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent mr-2" />
                          Refreshing...
                        </>
                      ) : (
                        <>
                          <RotateCcw className="h-4 w-4 mr-2" />
                          Refresh Models
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => setEditingModel({ provider })}
                      className="h-8"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Model
                    </Button>
                  )}
                </div>

                <div className="space-y-3">
                  {providerConfig?.available_models?.map((model, index) => (
                    <div key={index} className="flex items-center gap-3 p-4 rounded-lg border bg-card/50">
                      <Switch
                        checked={(providerConfig.enabled_models || []).includes(model.api_name)}
                        onCheckedChange={(checked) => toggleModel(provider, model.api_name, checked)}
                      />
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium truncate">{model.display_name}</p>
                          {model.tags?.map(tag => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                          {model.reasoning_level && model.tags?.includes('Reasoning') && (
                            <Badge variant="outline" className="text-xs">
                              {model.reasoning_level}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          API: {model.api_name}
                        </p>
                      </div>
                      
                      {provider !== 'ollama' && (
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingModel({ provider, model, index })}
                            className="h-8 w-8 p-0"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteModel(provider, index)}
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {(!providerConfig?.available_models || providerConfig.available_models.length === 0) && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Brain className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No models configured for this provider</p>
                      {provider !== 'ollama' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditingModel({ provider })}
                          className="mt-2"
                        >
                          Add your first model
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>

      {/* Model Edit Dialog */}
      <ModelEditDialog
        open={!!editingModel}
        onClose={() => setEditingModel(null)}
        provider={editingModel?.provider || ''}
        model={editingModel?.model}
        onSave={async (model) => await addOrUpdateModel(editingModel!.provider, model, editingModel!.index)}
        saving={saving}
      />
    </div>
  )
}

// Model Edit Dialog Component
interface ModelEditDialogProps {
  open: boolean
  onClose: () => void
  provider: string
  model?: ModelConfig
  onSave: (model: ModelConfig) => Promise<void>
  saving: boolean
}

function ModelEditDialog({ open, onClose, provider, model, onSave, saving }: ModelEditDialogProps) {
  const [formData, setFormData] = useState<ModelConfig>({
    display_name: '',
    api_name: '',
    tags: [],
    reasoning_level: undefined,
    enabled: true
  })

  useEffect(() => {
    if (model) {
      setFormData(model)
    } else {
      setFormData({
        display_name: '',
        api_name: '',
        tags: [],
        reasoning_level: undefined,
        enabled: true
      })
    }
  }, [model, open])

  const handleTagToggle = (tag: string) => {
    const newTags = formData.tags.includes(tag)
      ? formData.tags.filter(t => t !== tag)
      : [...formData.tags, tag]
    
    setFormData(prev => ({
      ...prev,
      tags: newTags,
      reasoning_level: newTags.includes('Reasoning') ? (prev.reasoning_level || 'medium') : undefined
    }))
  }

  const handleSave = async () => {
    if (!formData.display_name.trim() || !formData.api_name.trim()) {
      toast.error('Display name and API name are required')
      return
    }
    
    await onSave(formData)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {model ? 'Edit Model' : 'Add New Model'} - {provider}
          </DialogTitle>
          <DialogDescription>
            Configure the model settings for {provider} provider.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="display-name">Display Name</Label>
            <Input
              id="display-name"
              value={formData.display_name}
              onChange={(e) => setFormData(prev => ({ ...prev, display_name: e.target.value }))}
              placeholder="e.g., GPT-4 Turbo"
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="api-name">API Name</Label>
            <Input
              id="api-name"
              value={formData.api_name}
              onChange={(e) => setFormData(prev => ({ ...prev, api_name: e.target.value }))}
              placeholder="e.g., gpt-4-turbo-preview"
            />
          </div>
          
          <div className="space-y-2">
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-2">
              {['Reasoning', 'General', 'Code', 'Creative'].map(tag => (
                <Button
                  key={tag}
                  type="button"
                  variant={formData.tags.includes(tag) ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleTagToggle(tag)}
                >
                  {tag}
                </Button>
              ))}
            </div>
          </div>
          
          {formData.tags.includes('Reasoning') && (
            <div className="space-y-2">
              <Label htmlFor="reasoning-level">Reasoning Level</Label>
              <Select
                value={formData.reasoning_level || 'medium'}
                onValueChange={(value: 'low' | 'medium' | 'high') => 
                  setFormData(prev => ({ ...prev, reasoning_level: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent mr-2" />
                Saving...
              </>
            ) : (
              model ? 'Update Model' : 'Add Model'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}