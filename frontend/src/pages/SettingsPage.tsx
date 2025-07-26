// src/pages/SettingsPage.tsx
import { useEffect, useState } from 'react'
import { Button, TextField, Typography, Stack } from '@mui/material'
import { getConfig, setConfig } from '../api/ApiClient'

export default function SettingsPage() {
  const [config, setCfg] = useState<any>({})
  useEffect(()=>{ getConfig().then(res=>setCfg(res.data)) }, [])
  return (
    <Stack spacing={2}>
      <Typography variant="h4">Settings</Typography>
      {/* For demo, show raw JSON */}
      <TextField
        label="Config (JSON)"
        multiline
        fullWidth
        minRows={10}
        value={JSON.stringify(config, null, 2)}
        onChange={(e)=>setCfg(JSON.parse(e.target.value))}
      />
      <Button variant="contained" onClick={()=> setConfig(config)}>Save Settings</Button>
    </Stack>
  )
}