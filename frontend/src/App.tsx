// src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'sonner'

import { ThemeProvider as ShadcnThemeProvider } from './components/theme-provider'
import { AppLayout } from './components/layout/AppLayout'
import ErrorBoundary from './components/ErrorBoundary'

import LandingPage from './pages/LandingPage'
import SettingsPage from './pages/SettingsPage'
import FinderPage from './pages/FinderPage'
import PromptPage from './pages/PromptPage'
import ResultsPage from './pages/ResultsPage'
import HelpPage from './pages/HelpPage'
import LLMPage from './pages/LLMPage'

function App() {
  return (
    <ErrorBoundary>
      <ShadcnThemeProvider
        attribute="class"
        defaultTheme="dark"
        enableSystem
        disableTransitionOnChange
      >
        <BrowserRouter>
          <AppLayout>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/finder" element={<FinderPage />} />
              <Route path="/prompt" element={<PromptPage />} />
              <Route path="/results" element={<ResultsPage />} />
              <Route path="/llm" element={<LLMPage />} />
              <Route path="/help" element={<HelpPage />} />
            </Routes>
          </AppLayout>
        </BrowserRouter>
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
    </ErrorBoundary>
  )
}

export default App