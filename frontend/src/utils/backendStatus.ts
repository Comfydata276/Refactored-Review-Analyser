// src/utils/backendStatus.ts
import { api } from '../api/ApiClient'

export interface BackendStatus {
  isConnected: boolean
  hasResultsEndpoint: boolean
  hasResultsAppsEndpoint: boolean
}

export const checkBackendStatus = async (): Promise<BackendStatus> => {
  const status: BackendStatus = {
    isConnected: false,
    hasResultsEndpoint: false,
    hasResultsAppsEndpoint: false
  }

  try {
    // Check basic connectivity
    await api.get('/health')
    status.isConnected = true

    // Check if results endpoint exists
    try {
      await api.get('/results', { params: { page: 1, per_page: 1 } })
      status.hasResultsEndpoint = true
    } catch (error: any) {
      if (error?.response?.status !== 404) {
        status.hasResultsEndpoint = true // Endpoint exists but may have other errors
      }
    }

    // Check if results/apps endpoint exists
    try {
      await api.get('/results/apps')
      status.hasResultsAppsEndpoint = true
    } catch (error: any) {
      if (error?.response?.status !== 404) {
        status.hasResultsAppsEndpoint = true // Endpoint exists but may have other errors
      }
    }
  } catch (error) {
    console.log('Backend health check failed:', error)
  }

  return status
}