import { useEffect, useRef, useState } from 'react'
import { useBeforeUnload, useBlocker } from 'react-router-dom'

export interface UnsavedChangesOptions {
  hasUnsavedChanges: boolean
  onSave?: () => Promise<void> | void
  onDiscard?: () => void
}

export interface NavigationConfirmation {
  isBlocked: boolean
  proceed: () => void
  reset: () => void
  save: () => Promise<void>
  discard: () => void
}

export function useUnsavedChanges({
  hasUnsavedChanges,
  onSave,
  onDiscard
}: UnsavedChangesOptions): NavigationConfirmation {
  const [isProcessingSave, setIsProcessingSave] = useState(false)
  const savedOnSaveRef = useRef(onSave)
  const savedOnDiscardRef = useRef(onDiscard)

  // Update refs when callbacks change
  useEffect(() => {
    savedOnSaveRef.current = onSave
    savedOnDiscardRef.current = onDiscard
  }, [onSave, onDiscard])

  // Block navigation when there are unsaved changes
  let blocker: any
  try {
    blocker = useBlocker(
      ({ currentLocation, nextLocation }) => {
        return hasUnsavedChanges && currentLocation.pathname !== nextLocation.pathname && !isProcessingSave
      }
    )
  } catch (error) {
    console.warn('Navigation blocking not available:', error)
    // Fallback blocker object
    blocker = {
      state: 'unblocked',
      proceed: undefined,
      reset: undefined
    }
  }

  // Warn user before closing/refreshing browser tab
  useBeforeUnload(
    () => {
      if (hasUnsavedChanges && !isProcessingSave) {
        return 'You have unsaved changes. Are you sure you want to leave?'
      }
    }
  )

  const handleSave = async () => {
    if (savedOnSaveRef.current) {
      setIsProcessingSave(true)
      try {
        await savedOnSaveRef.current()
        blocker.proceed?.()
      } catch (error) {
        console.error('Error saving changes:', error)
        // Don't proceed if save failed
      } finally {
        setIsProcessingSave(false)
      }
    } else {
      blocker.proceed?.()
    }
  }

  const handleDiscard = () => {
    if (savedOnDiscardRef.current) {
      savedOnDiscardRef.current()
    }
    blocker.proceed?.()
  }

  return {
    isBlocked: blocker.state === 'blocked',
    proceed: () => blocker.proceed?.(),
    reset: () => blocker.reset?.(),
    save: handleSave,
    discard: handleDiscard
  }
}