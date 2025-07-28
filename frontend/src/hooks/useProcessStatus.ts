// src/hooks/useProcessStatus.ts
import { useMemo } from 'react'
import type { WSMessage, ProcessStatus } from '../types/websocket'

// Re-export for backward compatibility
export type { ProcessStatus }

export function useProcessStatus(messages: WSMessage[]): ProcessStatus {
  return useMemo(() => {

    if (messages.length === 0) {
      return {
        isRunning: false,
        processType: 'idle',
        statusMessage: 'No activity'
      }
    }

    // Get the latest few messages for analysis
    const recentMessages = messages.slice(-20) // Increase window for better detection
    const latestMessage = messages[messages.length - 1]

    // Find the most recent process state
    let isRunning = false
    let processType: 'scraping' | 'analysis' | 'idle' = 'idle'
    let lastCompletedProcess: 'scraping' | 'analysis' | null = null
    let completionMessage: string | null = null

    // First, look for explicit start/finish signals
    let lastStartMessage: WSMessage | null = null
    let lastFinishMessage: WSMessage | null = null

    // Find the most recent start and finish messages
    for (let i = recentMessages.length - 1; i >= 0; i--) {
      const msg = recentMessages[i]
      
      if (msg.type === 'analysis_started' && !lastStartMessage) {
        lastStartMessage = msg
      }
      
      if (msg.type === 'analysis_finished' && !lastFinishMessage) {
        lastFinishMessage = msg
      }
      
      // Break early if we found both
      if (lastStartMessage && lastFinishMessage) break
    }

    // Determine if process is running based on start/finish sequence
    if (lastStartMessage && lastFinishMessage) {
      // Compare timestamps or message order to see which is more recent
      const startIndex = recentMessages.indexOf(lastStartMessage)
      const finishIndex = recentMessages.indexOf(lastFinishMessage)
      
      if (startIndex > finishIndex) {
        // Start is more recent than finish - process is running
        isRunning = true
      } else {
        // Finish is more recent than start - process completed
        isRunning = false
      }
    } else if (lastStartMessage && !lastFinishMessage) {
      // Only start message found - process is running
      isRunning = true
    } else if (!lastStartMessage && lastFinishMessage) {
      // Only finish message found - process completed
      isRunning = false
    } else {
      // No explicit start/finish messages, fall back to content analysis
      for (let i = recentMessages.length - 1; i >= 0; i--) {
        const msg = recentMessages[i]
        const msgText = (msg.message || '').toLowerCase()

        // Check for explicit completion states first
        if (msg.status === 'complete' || msg.status === 'finished' || msg.status === 'stopped' ||
            msgText.includes('completed') || msgText.includes('finished') || msgText.includes('stopped') ||
            msgText.includes('done') || msgText.includes('success')) {
          
          if (!isRunning) {
            isRunning = false
            break
          }
          continue
        }

        // Check for running states
        if (msg.status === 'running' || msg.status === 'active' || msg.status === 'processing') {
          isRunning = true
          break
        }
        
        // Progress indicators suggest running process
        if ((msg.type === 'progress' || msg.progress) && msg.progress) {
          if (msg.progress.current < msg.progress.total) {
            isRunning = true
            break
          }
        }

        // Message content indicators for running processes
        if (msgText.includes('starting') || msgText.includes('processing') || 
            msgText.includes('scraping') || msgText.includes('analyzing') ||
            msgText.includes('downloading') || msgText.includes('fetching') ||
            msgText.includes('running')) {
          isRunning = true
          break
        }
      }
    }

    // Determine process type and completion details
    if (!isRunning && lastFinishMessage) {
      // Process completed - look for completion message and determine what completed
      for (let i = recentMessages.length - 1; i >= 0; i--) {
        const msg = recentMessages[i]
        const msgText = (msg.message || '').toLowerCase()
        
        if (msgText.includes('scrap') && (msgText.includes('complete') || msgText.includes('stopped'))) {
          lastCompletedProcess = 'scraping'
          completionMessage = msg.message
          break
        } else if (msgText.includes('analy') && (msgText.includes('complete') || msgText.includes('stopped'))) {
          lastCompletedProcess = 'analysis'
          completionMessage = msg.message
          break
        }
      }
      
      // If we couldn't determine from completion message, infer from recent activity
      if (!lastCompletedProcess) {
        for (let i = recentMessages.length - 1; i >= 0; i--) {
          const msg = recentMessages[i]
          const msgText = (msg.message || '').toLowerCase()
          
          if (msgText.includes('scrap') || msgText.includes('review') || msgText.includes('steam')) {
            lastCompletedProcess = 'scraping'
            break
          } else if (msgText.includes('analy') || msgText.includes('llm') || msgText.includes('ai')) {
            lastCompletedProcess = 'analysis'
            break
          }
        }
      }
      
      processType = lastCompletedProcess || 'idle'
      if (!completionMessage && lastCompletedProcess) {
        completionMessage = lastCompletedProcess === 'scraping' ? 'Scraping complete.' : 'Analysis complete.'
      }
    } else if (isRunning) {
      // Process is running - determine current process type
      for (let i = recentMessages.length - 1; i >= 0; i--) {
        const msg = recentMessages[i]
        
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
    }

    // If no process type determined yet, scan for any process type indicators
    if (processType === 'idle') {
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
    }

    // Get status message and current item
    let statusMessage = 'Ready'
    let currentItem: string | undefined

    if (isRunning) {
      // Process is currently running
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
    } else if (!isRunning && lastFinishMessage) {
      // Process completed - show completion details
      if (completionMessage) {
        statusMessage = completionMessage
      } else {
        // Look for the final completion message near the finish signal
        for (let i = recentMessages.length - 1; i >= 0; i--) {
          const msg = recentMessages[i]
          if (msg.type === 'log' && msg.message && 
              (msg.message.includes('complete') || msg.message.includes('stopped'))) {
            statusMessage = msg.message
            break
          }
        }
        
        // Fallback to generic completion message
        if (statusMessage === 'Ready') {
          statusMessage = processType === 'scraping' ? 'Scraping complete.' : 
                         processType === 'analysis' ? 'Analysis complete.' : 
                         'Process completed.'
        }
      }
    } else {
      // No active or recent completed process
      statusMessage = latestMessage?.message || 'Ready to start processing'
    }

    const result = {
      isRunning,
      processType,
      currentItem,
      progress: isRunning ? latestMessage?.progress : undefined, // Only show progress if running
      statusMessage,
      lastActivity: latestMessage?.timestamp
    }

    // Temporary debug logging to help troubleshoot
    if (lastStartMessage || lastFinishMessage) {
      console.log('🔍 ProcessStatus Debug:', {
        lastStartMessage: lastStartMessage?.type,
        lastFinishMessage: lastFinishMessage?.type,
        isRunning,
        processType,
        statusMessage,
        completionMessage,
        lastCompletedProcess
      })
    }

    return result
  }, [messages])
}