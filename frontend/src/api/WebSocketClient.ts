// src/api/WebSocketClient.ts
import { useEffect, useState, useRef } from 'react'
import type { WSMessage, WebSocketState } from '../types/websocket'

// Re-export types for backward compatibility
export type { WSMessage, WebSocketState }

export function useWebSocket(url: string): WebSocketState {
  const [messages, setMessages] = useState<WSMessage[]>([])
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
          setMessages((prev) => [...prev.slice(-49), msg]) // Keep last 50 messages
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
    reconnect 
  }
}