// src/pages/LandingPage.tsx
import { useState } from 'react'
import { 
  Button, Stack, Typography, Paper, Box, Chip, 
  LinearProgress, Alert, Card, CardContent,
  FormControlLabel, Switch
} from '@mui/material'
import { Stop, Analytics, CloudDownload } from '@mui/icons-material'
import { startScrape, startAnalyse, stopProcess } from '../api/ApiClient'
import { useWebSocket, type WSMessage } from '../api/WebSocketClient'

const getLevelColor = (level: string): 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' => {
  switch (level?.toLowerCase()) {
    case 'error': return 'error'
    case 'warning': return 'warning'
    case 'info': return 'info'
    case 'success': return 'success'
    default: return 'default'
  }
}

const formatTimestamp = (timestamp?: string) => {
  if (!timestamp) return new Date().toLocaleTimeString()
  return new Date(timestamp).toLocaleTimeString()
}

export default function LandingPage() {
  const { messages, connectionState, reconnect } = useWebSocket('/ws')
  // const [isProcessing, setIsProcessing] = useState(false)
  const [completeMode, setCompleteMode] = useState(false)
  const [skipScraping, setSkipScraping] = useState(false)

  const handleStartScrape = async () => {
    // setIsProcessing(true)
    try {
      await startScrape(completeMode)
    } catch (error) {
      console.error('Failed to start scraping:', error)
    }
  }

  const handleStartAnalysis = async () => {
    // setIsProcessing(true)
    try {
      await startAnalyse(completeMode, skipScraping)
    } catch (error) {
      console.error('Failed to start analysis:', error)
    }
  }

  const handleStop = async () => {
    try {
      await stopProcess()
      // setIsProcessing(false)
    } catch (error) {
      console.error('Failed to stop process:', error)
    }
  }

  // Detect if process is running from messages
  const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null
  const isRunning = lastMessage?.type === 'status' && lastMessage?.status === 'running'

  return (
    <Stack spacing={3}>
      <Typography variant="h4">Steam Review Analyzer Dashboard</Typography>
      
      {/* Control Panel */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>Process Control</Typography>
          
          {/* Options */}
          <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={completeMode}
                  onChange={(e) => setCompleteMode(e.target.checked)}
                  disabled={isRunning}
                />
              }
              label="Complete Scraping Mode"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={skipScraping}
                  onChange={(e) => setSkipScraping(e.target.checked)}
                  disabled={isRunning}
                />
              }
              label="Skip Scraping (Analysis Only)"
            />
          </Stack>

          {/* Action Buttons */}
          <Stack direction="row" spacing={2}>
            <Button
              variant="contained"
              startIcon={<CloudDownload />}
              onClick={handleStartScrape}
              disabled={isRunning}
              color="primary"
            >
              Start Scraping
            </Button>
            <Button
              variant="contained"
              startIcon={<Analytics />}
              onClick={handleStartAnalysis}
              disabled={isRunning}
              color="secondary"
            >
              Start Analysis
            </Button>
            <Button
              variant="contained"
              startIcon={<Stop />}
              onClick={handleStop}
              disabled={!isRunning}
              color="error"
            >
              Stop Process
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {/* Status Display */}
      {isRunning && (
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            Process is currently running. Check the activity log below for progress updates.
          </Typography>
          <LinearProgress sx={{ mt: 1 }} />
        </Alert>
      )}

      {/* Activity Log */}
      <Paper sx={{ height: 400, overflow: 'auto', p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">Activity Log</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              label={connectionState}
              size="small"
              color={
                connectionState === 'connected' ? 'success' :
                connectionState === 'connecting' ? 'warning' :
                connectionState === 'error' ? 'error' : 'default'
              }
            />
            {connectionState !== 'connected' && (
              <Button size="small" onClick={reconnect}>
                Reconnect
              </Button>
            )}
          </Box>
        </Box>
        
        {messages.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            {connectionState === 'connected' 
              ? 'No activity yet. Start a process to see real-time updates.'
              : 'Connecting to server for real-time updates...'
            }
          </Typography>
        ) : (
          <Stack spacing={1}>
            {messages.slice(-50).map((msg: WSMessage, i: number) => (
              <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="caption" color="text.secondary" sx={{ minWidth: 80 }}>
                  {formatTimestamp(msg.timestamp)}
                </Typography>
                <Chip
                  label={msg.level || msg.type || 'info'}
                  size="small"
                  color={getLevelColor(msg.level || msg.type)}
                  sx={{ minWidth: 70 }}
                />
                <Typography variant="body2" sx={{ flex: 1 }}>
                  {msg.message || JSON.stringify(msg)}
                </Typography>
              </Box>
            ))}
          </Stack>
        )}
      </Paper>
    </Stack>
  )
}