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
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<number | undefined>(undefined)

  const connect = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return
    }

    setConnectionState('connecting')
    
    try {
      const wsUrl = (import.meta.env.VITE_API_URL || 'ws://localhost:8000').replace(/^http/, 'ws') + '/ws'
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        setConnectionState('connected')
        console.log('WebSocket connected')
      }

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          console.log('📨 WebSocket received:', msg)
          setMessages((prev) => {
            const updated = [...prev.slice(-49), msg] // Keep last 50 messages in state
            saveMessages(updated) // Persist to localStorage
            return updated
          })
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error)
        }
      }

      ws.onclose = (event) => {
        setConnectionState('disconnected')
        
        // Only auto-reconnect if it was an unexpected closure and we previously had a connection
        if (event.code !== 1000 && event.code !== 1001) {
          reconnectTimeoutRef.current = window.setTimeout(() => {
            connect()
          }, 5000) // Increased timeout to reduce spam
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

  const send = (data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
    } else {
      console.warn('WebSocket is not connected')
    }
  }

  const reconnect = () => {
    if (reconnectTimeoutRef.current) {
      window.clearTimeout(reconnectTimeoutRef.current)
    }
    
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
    connect()

    return () => {
      if (reconnectTimeoutRef.current) {
        window.clearTimeout(reconnectTimeoutRef.current)
      }
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
    clearMessages
  }
}