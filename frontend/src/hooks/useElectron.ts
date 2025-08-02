import { useEffect, useState } from 'react'

// Type definitions for Electron API
declare global {
  interface Window {
    electronAPI?: {
      getAppVersion: () => Promise<string>
      getBackendStatus: () => Promise<{
        running: boolean
        host: string
        port: number
      }>
      restartBackend: () => Promise<boolean>
      openOutputFolder: () => Promise<boolean>
      platform: string
      isElectron: boolean
    }
    windowAPI?: {
      close: () => Promise<void>
      minimize: () => Promise<void>
      maximize: () => Promise<void>
    }
  }
}

export interface ElectronState {
  isElectron: boolean
  platform: string | null
  appVersion: string | null
  backendStatus: {
    running: boolean
    host: string
    port: number
  } | null
}

export function useElectron() {
  const [state, setState] = useState<ElectronState>({
    isElectron: false,
    platform: null,
    appVersion: null,
    backendStatus: null
  })

  useEffect(() => {
    // Check if running in Electron
    const isElectron = window.electronAPI?.isElectron || false
    const platform = window.electronAPI?.platform || null

    setState(prev => ({
      ...prev,
      isElectron,
      platform
    }))

    if (isElectron) {
      // Get app version
      window.electronAPI?.getAppVersion().then(version => {
        setState(prev => ({ ...prev, appVersion: version }))
      }).catch(console.error)

      // Get initial backend status
      refreshBackendStatus()
    }
  }, [])

  const refreshBackendStatus = async () => {
    if (!window.electronAPI) return

    try {
      const status = await window.electronAPI.getBackendStatus()
      setState(prev => ({ ...prev, backendStatus: status }))
    } catch (error) {
      console.error('Failed to get backend status:', error)
    }
  }

  const restartBackend = async () => {
    if (!window.electronAPI) return false

    try {
      const result = await window.electronAPI.restartBackend()
      if (result) {
        // Wait a moment then refresh status
        setTimeout(refreshBackendStatus, 2000)
      }
      return result
    } catch (error) {
      console.error('Failed to restart backend:', error)
      return false
    }
  }

  const openOutputFolder = async () => {
    if (!window.electronAPI) {
      // Fallback for web version - try to open via API
      try {
        const response = await fetch('/api/results/open-folder', { method: 'POST' })
        return response.ok
      } catch {
        return false
      }
    }

    try {
      return await window.electronAPI.openOutputFolder()
    } catch (error) {
      console.error('Failed to open output folder:', error)
      return false
    }
  }

  // Window management functions
  const windowClose = async () => {
    if (window.windowAPI) {
      await window.windowAPI.close()
    }
  }

  const windowMinimize = async () => {
    if (window.windowAPI) {
      await window.windowAPI.minimize()
    }
  }

  const windowMaximize = async () => {
    if (window.windowAPI) {
      await window.windowAPI.maximize()
    }
  }

  return {
    ...state,
    refreshBackendStatus,
    restartBackend,
    openOutputFolder,
    windowClose,
    windowMinimize,
    windowMaximize
  }
}