// src/api/WebSocketClient.ts
import { useEffect, useState } from 'react'

export interface WSMessage { type: string; [key:string]: any }

export function useWebSocket(
  url: string,
): { messages: WSMessage[]; send?: (data:any)=>void } {
  const [messages, setMessages] = useState<WSMessage[]>([])

  useEffect(() => {
    const ws = new WebSocket((import.meta.env.VITE_API_URL || 'ws://localhost:8000').replace(/^http/, 'ws') + '/ws')
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data)
        setMessages((m) => [...m, msg])
      } catch {}
    }
    return () => { ws.close() }
  }, [url])

  return { messages }
}