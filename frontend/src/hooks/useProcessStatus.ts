// src/hooks/useProcessStatus.ts
import { useMemo } from 'react'
import type { WSMessage, ProcessStatus } from '../types/websocket'

// Re-export for backward compatibility
export type { ProcessStatus }

export function useProcessStatus(messages: WSMessage[]): ProcessStatus {
  return useMemo(() => {
    // Debug: Log all messages to understand what we're receiving
    console.log('🔍 ProcessStatus Debug - Total messages:', messages.length)
    if (messages.length > 0) {
      console.log('🔍 Latest 3 messages:', messages.slice(-3))
    }

    if (messages.length === 0) {
      return {
        isRunning: false,
        processType: 'idle',
        statusMessage: 'No activity'
      }
    }

    // Get the latest few messages for analysis
    const recentMessages = messages.slice(-10)
    const latestMessage = messages[messages.length - 1]

    console.log('🔍 Latest message:', latestMessage)

    // More comprehensive running detection
    let isRunning = false
    let processType: 'scraping' | 'analysis' | 'idle' = 'idle'

    // Check multiple indicators for running processes
    for (const msg of recentMessages.reverse()) {
      // Explicit status indicators
      if (msg.status === 'running' || msg.status === 'active') {
        isRunning = true
        break
      }
      
      // Progress indicators
      if (msg.type === 'progress' || msg.progress) {
        if (msg.progress && msg.progress.current < msg.progress.total) {
          isRunning = true
          break
        }
      }

      // Message content indicators
      const msgText = (msg.message || '').toLowerCase()
      if (msgText.includes('starting') || msgText.includes('processing') || 
          msgText.includes('scraping') || msgText.includes('analyzing') ||
          msgText.includes('downloading') || msgText.includes('fetching')) {
        isRunning = true
        break
      }

      // Stop indicators
      if (msg.status === 'stopped' || msg.status === 'complete' || msg.status === 'finished' ||
          msgText.includes('completed') || msgText.includes('finished') || msgText.includes('stopped')) {
        isRunning = false
        break
      }
    }

    // Determine process type from recent messages
    for (const msg of recentMessages.reverse()) {
      if (msg.process_type) {
        processType = msg.process_type
        break
      }
      
      const msgText = (msg.message || '').toLowerCase()
      if (msgText.includes('scrap') || msgText.includes('download') || msgText.includes('review') || msgText.includes('steam')) {
        processType = 'scraping'
        break
      } else if (msgText.includes('analy') || msgText.includes('llm') || msgText.includes('ai') || msgText.includes('sentiment')) {
        processType = 'analysis'
        break
      }
    }

    // Get status message
    let statusMessage = 'Ready'
    let currentItem: string | undefined

    if (isRunning) {
      if (latestMessage?.current_item) {
        currentItem = latestMessage.current_item
        statusMessage = `Processing ${latestMessage.current_item}`
      } else if (latestMessage?.message) {
        statusMessage = latestMessage.message
      } else {
        statusMessage = processType === 'scraping' 
          ? 'Scraping reviews from Steam...' 
          : processType === 'analysis'
          ? 'Analyzing review data...'
          : 'Process running...'
      }
    } else {
      statusMessage = latestMessage?.message || 'Ready to start processing'
    }

    const result = {
      isRunning,
      processType,
      currentItem,
      progress: latestMessage?.progress,
      statusMessage,
      lastActivity: latestMessage?.timestamp
    }

    console.log('🔍 ProcessStatus Result:', result)
    return result
  }, [messages])
}