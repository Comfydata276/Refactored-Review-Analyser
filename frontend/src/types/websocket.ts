// src/types/websocket.ts

export interface WSMessage { 
  type: string
  level?: string
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
  status?: string
  process_type?: 'scraping' | 'analysis' | 'idle'
  current_item?: string
  
  [key:string]: any 
}

export interface WebSocketState {
  messages: WSMessage[]
  connectionState: 'connecting' | 'connected' | 'disconnected' | 'error'
  send?: (data: any) => void
  reconnect: () => void
}

export interface ProcessStatus {
  isRunning: boolean
  processType: 'scraping' | 'analysis' | 'idle'
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