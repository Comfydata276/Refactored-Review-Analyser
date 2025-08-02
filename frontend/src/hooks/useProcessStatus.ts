import { useEffect, useReducer, useRef } from "react"
import type { WSMessage } from "../types/websocket"

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

type Phase = "scraping" | "analysis" | "batch_analysis" | "idle"

export interface ProcessStatus {
  isRunning: boolean
  processType: Phase
  statusMessage: string
  currentItem?: string
  progress?: { current: number; total: number; percentage: number }
  lastFinished?: Phase
}

/* ------------------------------------------------------------------ */
/*  Reducer                                                           */
/* ------------------------------------------------------------------ */

const initialState: ProcessStatus = {
  isRunning: false,
  processType: "idle",
  statusMessage: "Ready"
}

function reducer(state: ProcessStatus, msg: WSMessage | { type: '_rebuild_complete', payload: ProcessStatus }): ProcessStatus {
  switch (msg.type) {
    /* Special case for rebuilding status from all messages */
    case "_rebuild_complete":
      return (msg as any).payload
    /* -------------------------------------------------------------- */
    /*  Phase starts                                                  */
    /* -------------------------------------------------------------- */
    case "phase_change": {
      if (!msg.phase) return state
      if (msg.phase === "idle") {
        return { ...state, isRunning: false, processType: "idle" }
      }

      const phase = msg.phase as Phase
      return {
        isRunning: true,
        processType: phase,
        statusMessage:
          phase === "scraping"
            ? "Scraping reviews…"
            : phase === "analysis"
            ? "Analyzing reviews…"
            : "Running batch analysis…",
        currentItem: undefined,
        progress: undefined
      }
    }

    /* -------------------------------------------------------------- */
    /*  Phase finished                                                */
    /* -------------------------------------------------------------- */
    case "phase_end": {
      const done = (msg.phase ?? state.processType) as Phase
      return {
        isRunning: false,
        processType: "idle",
        statusMessage:
          done === "scraping"
            ? "Scraping completed"
            : done === "batch_analysis"
            ? "Batch analysis completed"
            : "Analysis completed",
        lastFinished: done
      }
    }

    /* legacy support */
    case "analysis_finished":
      return {
        isRunning: false,
        processType: "idle",
        statusMessage:
          state.processType === "scraping"
            ? "Scraping completed"
            : state.processType === "batch_analysis"
            ? "Batch analysis completed"
            : "Analysis completed",
        lastFinished: state.processType
      }

    /* -------------------------------------------------------------- */
    /*  Context / label                                               */
    /* -------------------------------------------------------------- */
    case "status_update": {
      const label = msg.app ?? msg.model ?? ""
      return { ...state, currentItem: label, statusMessage: `Processing ${label}` }
    }

    /* -------------------------------------------------------------- */
    /*  Progress bar                                                  */
    /* -------------------------------------------------------------- */
    case "progress_apps_total":
      return {
        ...state,
        progress: { current: 0, total: msg.value ?? 0, percentage: 0 }
      }

    case "progress_apps_current":
      return state.progress
        ? {
            ...state,
            progress: {
              ...state.progress,
              current: msg.value ?? state.progress.current,
              percentage:
                state.progress.total > 0
                  ? ((msg.value ?? 0) / state.progress.total) * 100
                  : 0
            }
          }
        : state

    /* -------------------------------------------------------------- */
    /*  Live log message while running                                */
    /* -------------------------------------------------------------- */
    case "log":
      return state.isRunning
        ? { ...state, statusMessage: msg.message ?? state.statusMessage }
        : state

    default:
      return state
  }
}

/* ------------------------------------------------------------------ */
/*  Hook                                                              */
/* ------------------------------------------------------------------ */

export function useProcessStatus(messages: WSMessage[]): ProcessStatus {
  const [status, dispatch] = useReducer(reducer, initialState)

  /* Index of the last element we dispatched */
  const cursor = useRef(-1)
  const lastRebuildTime = useRef(0)

  /* Force rebuild status from all messages when page becomes visible */
  const rebuildStatusFromAllMessages = () => {
    console.log('🔄 Rebuilding process status from all messages')
    let newStatus = initialState
    
    // Process all messages to rebuild current state
    for (const message of messages) {
      newStatus = reducer(newStatus, message)
    }
    
    // Reset the cursor to the current length
    cursor.current = messages.length - 1
    lastRebuildTime.current = Date.now()
    
    // Force update the status
    dispatch({ type: '_rebuild_complete', payload: newStatus } as any)
  }

  /* Handle page visibility changes */
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Page became visible - check if we need to rebuild
        const timeSinceLastRebuild = Date.now() - lastRebuildTime.current
        if (timeSinceLastRebuild > 5000) { // Rebuild if it's been more than 5 seconds
          rebuildStatusFromAllMessages()
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [messages])

  useEffect(() => {
    if (messages.length === 0) {
      cursor.current = -1
      return
    }

    /* If the array has shrunk (trimmed to 50) reset the cursor and rebuild */
    if (cursor.current >= messages.length) {
      console.log('📊 Messages array shrunk, rebuilding status')
      rebuildStatusFromAllMessages()
      return
    }

    /* Dispatch every *new* message                                    */
    let hasNewMessages = false
    for (let i = cursor.current + 1; i < messages.length; i++) {
      dispatch(messages[i])
      hasNewMessages = true
    }

    if (hasNewMessages) {
      cursor.current = messages.length - 1
    }
  }, [messages])     // ← runs every time WebSocket updates the array

  return status
}