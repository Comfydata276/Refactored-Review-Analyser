// src/pages/LandingPage.tsx
import { Button, Stack, Typography, Paper } from '@mui/material'
import { startScrape, startAnalyse, stopProcess } from '../api/ApiClient'
import { useWebSocket } from '../api/WebSocketClient'

export default function LandingPage() {
  const { messages } = useWebSocket('/ws')
  return (
    <Stack spacing={2}>
      <Typography variant="h4">Dashboard</Typography>
      <Stack direction="row" spacing={2}>
        <Button variant="contained" onClick={()=> startScrape(false)}>Scrape</Button>
        <Button variant="contained" onClick={()=> startAnalyse(false,false)}>Analyse</Button>
        <Button variant="contained" color="error" onClick={stopProcess}>Stop</Button>
      </Stack>

      <Paper sx={{ height:300, overflow:'auto', p:1, mt:2 }}>
        {messages.map((m,i)=><div key={i}>[{m.level||m.type}] {m.message||JSON.stringify(m)}</div>)}
      </Paper>
    </Stack>
  )
}