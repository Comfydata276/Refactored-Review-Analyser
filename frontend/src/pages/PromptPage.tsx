// src/pages/PromptPage.tsx
import { useEffect, useState } from 'react'
import { Stack, Typography, Button } from '@mui/material'
import Editor from '@monaco-editor/react'
import { getConfig, setConfig } from '../api/ApiClient'

export default function PromptPage() {
  const [prompt, setPrompt] = useState('')
  const [dirty, setDirty] = useState(false)
  const [cfg, setCfg] = useState<any>(null)

  useEffect(() => {
    getConfig().then(r => {
      setCfg(r.data)
      setPrompt(r.data.analysis.default_prompt || '')
    })
  }, [])

  const save = () => {
    const next = { ...cfg, analysis:{...cfg.analysis, default_prompt:prompt} }
    setConfig(next).then(()=> setDirty(false))
  }

  return (
    <Stack spacing={2}>
      <Typography variant="h4">LLM Prompt Editor</Typography>
      <div style={{ height:'60vh' }}>
        <Editor
          height="100%"
          language="markdown"
          value={prompt}
          onChange={(value: string | undefined) => { 
            setPrompt(value || ''); 
            setDirty(true) 
          }}
        />
      </div>
      <Button
        variant="contained"
        disabled={!dirty}
        onClick={save}
      >
        Save Prompt
      </Button>
    </Stack>
  )
}