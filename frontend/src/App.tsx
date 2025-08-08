// src/App.tsx
import { createBrowserRouter, RouterProvider, HashRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'sonner'

import { ThemeProvider as ShadcnThemeProvider } from './components/theme-provider'
import { AppLayout } from './components/layout/AppLayout'
import ErrorBoundary from './components/ErrorBoundary'
import { DropdownStateProvider } from './contexts/DropdownStateContext'

import LandingPage from './pages/LandingPage'
import SettingsPage from './pages/SettingsPage'
import FinderPage from './pages/FinderPage'
import PromptPage from './pages/PromptPage'
import ResultsPage from './pages/ResultsPage'
import HelpPage from './pages/HelpPage'
import LLMPage from './pages/LLMPage'

// Detect if running in Electron
const isElectron = window.electronAPI !== undefined

// Use HashRouter for Electron (file:// protocol) and BrowserRouter for web
const router = !isElectron ? createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: <LandingPage />
      },
      {
        path: "settings",
        element: <SettingsPage />
      },
      {
        path: "finder",
        element: <FinderPage />
      },
      {
        path: "prompt",
        element: <PromptPage />
      },
      {
        path: "results",
        element: <ResultsPage />
      },
      {
        path: "llm",
        element: <LLMPage />
      },
      {
        path: "help",
        element: <HelpPage />
      }
    ]
  }
]) : null

function App() {
  return (
    <ErrorBoundary>
      <DropdownStateProvider>
        <ShadcnThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {isElectron ? (
            <HashRouter>
              <Routes>
                <Route path="/" element={<AppLayout />}>
                  <Route index element={<LandingPage />} />
                  <Route path="settings" element={<SettingsPage />} />
                  <Route path="finder" element={<FinderPage />} />
                  <Route path="prompt" element={<PromptPage />} />
                  <Route path="results" element={<ResultsPage />} />
                  <Route path="llm" element={<LLMPage />} />
                  <Route path="help" element={<HelpPage />} />
                </Route>
              </Routes>
            </HashRouter>
          ) : (
            <RouterProvider router={router!} />
          )}
          <Toaster 
            position="bottom-right" 
            toastOptions={{
              style: {
                background: 'hsl(var(--background))',
                color: 'hsl(var(--foreground))',
                border: '1px solid hsl(var(--border))',
              },
            }}
          />
        </ShadcnThemeProvider>
      </DropdownStateProvider>
    </ErrorBoundary>
  )
}

export default App