import { createContext, useContext, useState, type ReactNode } from 'react'

interface DropdownState {
  [key: string]: string[] // accordion values are arrays of strings
}

interface DropdownStateContextType {
  getDropdownState: (id: string) => string[]
  setDropdownState: (id: string, values: string[]) => void
  clearDropdownState: (id: string) => void
  clearAllDropdownStates: () => void
  hasDropdownState: (id: string) => boolean
}

const DropdownStateContext = createContext<DropdownStateContextType | undefined>(undefined)

interface DropdownStateProviderProps {
  children: ReactNode
}

export function DropdownStateProvider({ children }: DropdownStateProviderProps) {
  const [dropdownStates, setDropdownStates] = useState<DropdownState>({})

  const getDropdownState = (id: string): string[] => {
    return dropdownStates[id] || []
  }

  const hasDropdownState = (id: string): boolean => {
    return id in dropdownStates
  }

  const setDropdownState = (id: string, values: string[]): void => {
    setDropdownStates(prev => ({
      ...prev,
      [id]: values
    }))
  }

  const clearDropdownState = (id: string): void => {
    setDropdownStates(prev => {
      const updated = { ...prev }
      delete updated[id]
      return updated
    })
  }

  const clearAllDropdownStates = (): void => {
    setDropdownStates({})
  }

  return (
    <DropdownStateContext.Provider
      value={{
        getDropdownState,
        setDropdownState,
        clearDropdownState,
        clearAllDropdownStates,
        hasDropdownState
      }}
    >
      {children}
    </DropdownStateContext.Provider>
  )
}

export function useDropdownState() {
  const context = useContext(DropdownStateContext)
  if (!context) {
    throw new Error('useDropdownState must be used within a DropdownStateProvider')
  }
  return context
}

// Convenience hook for individual accordion components
export function useAccordionState(id: string, defaultValues: string[] = []) {
  const { getDropdownState, setDropdownState, hasDropdownState } = useDropdownState()
  
  const values = getDropdownState(id)
  const hasStoredState = hasDropdownState(id)
  
  const handleValueChange = (newValues: string[]) => {
    // Always update the state, even if it's an empty array (allows closing all)
    setDropdownState(id, newValues)
  }

  return {
    value: hasStoredState ? values : defaultValues,
    onValueChange: handleValueChange
  }
}