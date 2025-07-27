// src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'

import NavBar from './components/NavBar'
import SideDrawer from './components/SideDrawer'
import ErrorBoundary from './components/ErrorBoundary'

import LandingPage from './pages/LandingPage'
import SettingsPage from './pages/SettingsPage'
import FinderPage from './pages/FinderPage'
import PromptPage from './pages/PromptPage'
import ResultsPage from './pages/ResultsPage'
import HelpPage from './pages/HelpPage'

import { theme } from './theme'

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <BrowserRouter>
          <SideDrawer>
            <NavBar />
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/finder" element={<FinderPage />} />
              <Route path="/prompt" element={<PromptPage />} />
              <Route path="/results" element={<ResultsPage />} />
              <Route path="/help" element={<HelpPage />} />
            </Routes>
          </SideDrawer>
        </BrowserRouter>
      </ThemeProvider>
    </ErrorBoundary>
  )
}

export default App