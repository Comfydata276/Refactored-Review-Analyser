// src/api/WebSocketClient.ts
import { useEffect, useState, useRef } from 'react'
import type { WSMessage, WebSocketState } from '../types/websocket'

// Re-export types for backward compatibility
export type { WSMessage, WebSocketState }

// Persistent message storage utilities
const MESSAGES_STORAGE_KEY = 'dashboard_messages'
const MAX_STORED_MESSAGES = 100

const loadStoredMessages = (): WSMessage[] => {
  try {
    const stored = localStorage.getItem(MESSAGES_STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      // Validate that it's an array of messages
      if (Array.isArray(parsed)) {
        return parsed.slice(-MAX_STORED_MESSAGES) // Keep only the most recent messages
      }
    }
  } catch (error) {
    console.warn('Failed to load stored messages:', error)
  }
  return []
}

const saveMessages = (messages: WSMessage[]) => {
  try {
    // Only store the most recent messages to prevent localStorage bloat
    const messagesToStore = messages.slice(-MAX_STORED_MESSAGES)
    localStorage.setItem(MESSAGES_STORAGE_KEY, JSON.stringify(messagesToStore))
  } catch (error) {
    console.warn('Failed to save messages:', error)
  }
}

export function useWebSocket(url: string): WebSocketState {
  const [messages, setMessages] = useState<WSMessage[]>(() => loadStoredMessages())
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting')
  const [forceUpdate, setForceUpdate] = useState(0)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<number | undefined>(undefined)
  const heartbeatIntervalRef = useRef<number | undefined>(undefined)
  const isPageVisibleRef = useRef<boolean>(true)
  const reconnectAttemptsRef = useRef<number>(0)

  const startHeartbeat = () => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current)
    }
    
    heartbeatIntervalRef.current = window.setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        if (isPageVisibleRef.current) {
          // Send a ping to keep connection alive when page is visible
          wsRef.current.send(JSON.stringify({ type: 'ping' }))
        } else {
          // When page is hidden, just check connection status
          if (wsRef.current.readyState !== WebSocket.OPEN) {
            console.log('⚠️ WebSocket connection lost while page hidden')
          }
        }
      }
    }, 15000) // Check every 15 seconds (more frequent)
  }

  const stopHeartbeat = () => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current)
      heartbeatIntervalRef.current = undefined
    }
  }

  const connect = async () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return
    }

    setConnectionState('connecting')
    
    try {
      // Resolve target URL
      const target = url || '/ws'
      let wsUrl: string | undefined

      const isAbsoluteWS = /^wss?:\/\//i.test(target)
      const isAbsoluteHTTP = /^https?:\/\//i.test(target)
      const isRelative = target.startsWith('/')

      // Prefer Electron-provided host/port when available and target is relative
      // Narrowly typed access to Electron preload bridge (if available)
      type ElectronBridge = {
        electronAPI?: {
          getBackendStatus: () => Promise<{ host: string; port: number; running?: boolean }>
        }
      }
      const w = window as unknown as ElectronBridge
      if (isRelative && w?.electronAPI?.getBackendStatus) {
        try {
          const status = await w.electronAPI.getBackendStatus()
          const proto = location.protocol === 'https:' ? 'wss' : 'ws'
          wsUrl = `${proto}://${status.host}:${status.port}${target}`
        } catch {
          // fall through to env-based resolution
        }
      }

      if (!wsUrl) {
        if (isAbsoluteWS) {
          wsUrl = target
        } else if (isAbsoluteHTTP) {
          wsUrl = target.replace(/^http/i, 'ws')
        } else {
          const base = (import.meta.env.VITE_API_URL || 'http://localhost:8000')
          const baseWs = base.replace(/^http/i, 'ws').replace(/\/+$/, '')
          wsUrl = `${baseWs}${isRelative ? target : `/${target}`}`
        }
      }

      // Optional readiness ping to reduce "closed before established" during startup races
      try {
        const healthUrl = wsUrl.replace(/^ws/i, 'http').replace(/\/ws$/, '/health')
        let ok = false
        let delay = 500
        for (let i = 0; i < 5; i++) {
          try {
            const controller = new AbortController()
            const t = window.setTimeout(() => controller.abort(), 1200)
            const res = await fetch(healthUrl, { signal: controller.signal, cache: 'no-store' })
            window.clearTimeout(t)
            if (res.ok) { ok = true; break }
          } catch {
            // ignore and backoff
          }
          await new Promise(r => setTimeout(r, delay))
          delay = Math.min(5000, delay * 2)
        }
        if (!ok) {
          console.warn('WebSocket: backend health not confirmed, attempting to connect anyway:', healthUrl)
        }
      } catch {
        // ignore ping errors and continue
      }

      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        setConnectionState('connected')
        reconnectAttemptsRef.current = 0
        console.log('WebSocket connected', wsUrl)
        startHeartbeat()
      }

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          
          // Skip ping responses
          if (msg.type === 'pong') return
          
          console.log('📨 WebSocket received:', msg)
          setMessages((prev) => {
            const updated = [...prev.slice(-49), msg] // Keep last 50 messages in state
            saveMessages(updated) // Persist to localStorage
            return updated
          })
          
          // Force immediate UI update if page is visible
          if (isPageVisibleRef.current) {
            // Use requestAnimationFrame to ensure immediate updates
            requestAnimationFrame(() => {
              setForceUpdate(prev => prev + 1)
            })
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
        }
      }

      ws.onclose = (event) => {
        setConnectionState('disconnected')
        stopHeartbeat()
        
        // Only auto-reconnect if it was an unexpected closure and we previously had a connection
        if (event.code !== 1000 && event.code !== 1001) {
          const attempt = ++reconnectAttemptsRef.current
          const delay = Math.min(15000, Math.max(500, 500 * Math.pow(2, attempt - 1)))
          console.log(`WebSocket closed (code=${event.code}). Reconnecting in ${delay}ms (attempt ${attempt})`)
          reconnectTimeoutRef.current = window.setTimeout(() => {
            if (isPageVisibleRef.current) {
              connect()
            }
          }, delay)
        }
      }

      ws.onerror = () => {
        setConnectionState('error')
        console.warn('WebSocket connection failed - this is normal if the backend is not running')
        // Don't log the full error object as it's not helpful for users
      }
    } catch (error) {
      setConnectionState('error')
      console.error('Failed to create WebSocket connection:', error)
    }
  }

  const send = (data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data as unknown))
    } else {
      console.warn('WebSocket is not connected')
    }
  }

  const reconnect = () => {
    if (reconnectTimeoutRef.current) {
      window.clearTimeout(reconnectTimeoutRef.current)
    }
    
    stopHeartbeat()
    reconnectAttemptsRef.current = 0
    
    if (wsRef.current) {
      wsRef.current.close()
    }
    
    connect()
  }

  const clearMessages = () => {
    setMessages([])
    localStorage.removeItem(MESSAGES_STORAGE_KEY)
  }

  useEffect(() => {
    // Handle page visibility changes
    const handleVisibilityChange = () => {
      const isVisible = !document.hidden
      isPageVisibleRef.current = isVisible
      
      if (isVisible) {
        // Page became visible - ensure connection is active and force UI refresh
        console.log('🔍 Page became visible - checking WebSocket connection')
        if (wsRef.current?.readyState !== WebSocket.OPEN) {
          console.log('🔄 Reconnecting WebSocket due to page visibility change')
          connect()
        }
        
        // Aggressively force UI updates when page becomes visible
        requestAnimationFrame(() => {
          setForceUpdate(prev => prev + 1)
          // Force multiple updates to ensure React processes everything
          setTimeout(() => setForceUpdate(prev => prev + 1), 50)
          setTimeout(() => setForceUpdate(prev => prev + 1), 100)
        })
        
        console.log('✨ Forced UI refresh due to page visibility change')
      } else {
        // Page became hidden - we'll keep the connection but stop sending pings
        console.log('👁️ Page became hidden - WebSocket will reduce activity')
      }
    }

    // Add page visibility listener
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    // Initial connection
    connect()

    return () => {
      // Cleanup
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      
      if (reconnectTimeoutRef.current) {
        window.clearTimeout(reconnectTimeoutRef.current)
      }
      
      stopHeartbeat()
      
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounting')
      }
    }
  }, [url])

  return { 
    messages, 
    connectionState, 
    send: connectionState === 'connected' ? send : undefined,
    reconnect,
    clearMessages,
    _forceUpdate: forceUpdate // Internal state to trigger re-renders
  }
}