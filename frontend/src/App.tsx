// src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'

import NavBar from './components/NavBar'
import SideDrawer from './components/SideDrawer'

import LandingPage from './pages/LandingPage'
import SettingsPage from './pages/SettingsPage'
// import FinderPage from './pages/FinderPage'
// import PromptPage from './pages/PromptPage'
// import HelpPage from './pages/HelpPage'

import { theme } from './theme'

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <SideDrawer>
          <NavBar />
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            {/* <Route path="/finder" element={<FinderPage />} />
            <Route path="/prompt" element={<PromptPage />} />
            <Route path="/help" element={<HelpPage />} /> */}
          </Routes>
        </SideDrawer>
      </BrowserRouter>
    </ThemeProvider>
  )
}

export default App