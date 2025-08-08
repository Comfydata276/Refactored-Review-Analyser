// src/api/ApiClient.ts
import axios from 'axios'

// Default base URL (works for web and fallback)
const defaultBaseURL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export const api = axios.create({
  baseURL: defaultBaseURL,
  headers: { 'Content-Type': 'application/json' },
})

// If running in Electron, derive base URL from the backend status (host/port).
// This avoids mismatches and supports custom ports.
type ElectronBridge = {
  electronAPI?: {
    getBackendStatus: () => Promise<{ host: string; port: number; running?: boolean }>
    openOutputFolder: () => Promise<boolean>
  }
}

const w = (globalThis as unknown as { window?: unknown }).window as unknown as ElectronBridge | undefined
if (w?.electronAPI?.getBackendStatus) {
  (async () => {
    try {
      const status = await w.electronAPI!.getBackendStatus()
      const proto = location.protocol === 'https:' ? 'https' : 'http'
      const resolved = `${proto}://${status.host}:${status.port}`
      api.defaults.baseURL = resolved
      // Optional: visible console to aid debugging packaged builds
      // eslint-disable-next-line no-console
      console.log('API baseURL set from Electron backend status:', resolved)
    } catch {
      // Keep default base URL on failure
    }
  })()
}

// Configuration endpoints
export const getConfig = () => api.get('/config')
export const setConfig = (config: unknown) => api.post('/config', config as unknown)

// App search endpoints  
export const searchApps = (q: string, type='name', page=1, per_page=20) =>
  api.get('/apps/search', { params: { query:q, type, page, per_page } })

// Prompt management endpoints
export const getPrompts = () => api.get('/prompts')
export const getPrompt = () => api.get('/prompt')
export const savePrompt = (content: string) => api.post('/prompt', { content })
export const selectPrompt = (filename: string) => api.post('/prompt/select', { filename })
export const uploadPrompt = (file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  return api.post('/prompt/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}
export const deletePrompt = (filename: string) => api.delete(`/prompt/${filename}`)

// Process control endpoints
export const startAnalyse = (complete=false, skip=false) =>
  api.post('/analyse', { complete, skip })
export const startScrape = (complete=false) =>
  api.post('/scrape', { complete })
export const stopProcess = () => api.post('/stop')

// Results endpoints
export const getResultsFiles = () => api.get('/results/files')
export const getResultsFileContent = (fileType: string, filename: string, limit: number = 100) =>
  api.get(`/results/file/${fileType}/${filename}`, { params: { limit } })

// Prefer Electron IPC for opening folders when available; fallback to HTTP API
export const openResultsFolder = async () => {
  const w2 = (globalThis as unknown as { window?: unknown }).window as unknown as ElectronBridge | undefined
  if (w2?.electronAPI?.openOutputFolder) {
    try {
      const ok = await w2.electronAPI.openOutputFolder()
      return { data: { status: ok ? 'success' : 'failed', message: ok ? 'Opened output folder' : 'Failed to open output folder' } }
    } catch {
      // fall through to HTTP fallback
    }
  }
  return api.post('/results/open-folder')
}

// API Key management endpoints
export const getApiKeys = () => api.get('/api-keys')
export const setApiKey = (provider: string, apiKey: string) => 
  api.post(`/api-keys/${provider}`, { api_key: apiKey })
export const removeApiKey = (provider: string) => api.delete(`/api-keys/${provider}`)

// LLM management endpoints
export const getOllamaModels = () => api.get('/llm/ollama/models')
export const refreshOllamaModels = () => api.post('/llm/ollama/refresh')

// Legacy endpoints (kept for backward compatibility)
export const getResults = (params?: Record<string, unknown>) =>
  api.get('/results', { params })
export const getAvailableApps = () =>
  api.get('/results/apps')
export const exportResults = (format: 'csv' | 'json', filters?: Record<string, unknown>) =>
  api.get('/results/export', {
    params: { format, ...(filters ?? {}) },
    responseType: 'blob'
  })