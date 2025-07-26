// src/api/ApiClient.ts
import axios from 'axios'

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export const api = axios.create({
  baseURL,
  headers: { 'Content-Type': 'application/json' },
})

// Example helper
export const getConfig = () => api.get('/config')
export const setConfig = (config: any) => api.post('/config', config)
export const searchApps = (q: string, type='name', page=1, per_page=20) =>
  api.get('/apps/search', { params: { query:q, type, page, per_page } })
export const startAnalyse = (complete=false, skip=false) =>
  api.post('/analyse', { complete, skip })
export const startScrape = (complete=false) =>
  api.post('/scrape', { complete })
export const stopProcess = () => api.post('/stop')