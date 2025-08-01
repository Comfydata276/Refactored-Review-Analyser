// src/types/websocket.ts

export interface WSMessage { 
  type:
    | "log"
    | "analysis_started"
    | "analysis_finished"
    | "progress"
    | "status_update"
    | "progress_apps_total"
    | "progress_apps_current"
    | "process_type_change"
    | "phase_change"
    | "phase_end"
    | string
  level?: 'info' | 'warning' | 'error' | string
  message?: string
  timestamp?: string
  
  // Progress information
  progress?: {
    current: number
    total: number
    percentage: number
    eta?: string
    speed?: string
  }
  
  // Process status information
  status?: 'running' | 'complete' | 'stopped' | 'finished' | string
  process_type?: 'scraping' | 'analysis' | 'batch_analysis' | 'idle'
  current_item?: string
  
  // Additional backend-specific fields
  value?: number  // For progress_apps_total and progress_apps_current
  app?: string    // For status_update messages
  model?: string  // For status_update messages
  phase?: 'scraping' | 'analysis' | 'batch_analysis' | 'idle'  // For phase_change messages
  
  [key:string]: any 
}

export interface WebSocketState {
  messages: WSMessage[]
  connectionState: 'connecting' | 'connected' | 'disconnected' | 'error'
  send?: (data: any) => void
  reconnect: () => void
  clearMessages: () => void
  _forceUpdate?: number // Internal state to trigger re-renders
}

export interface ProcessStatus {
  isRunning: boolean
  processType: 'scraping' | 'analysis' | 'batch_analysis' | 'idle'
  currentItem?: string
  progress?: {
    current: number
    total: number
    percentage: number
    eta?: string
    speed?: string
  }
  statusMessage?: string
  lastActivity?: string
}