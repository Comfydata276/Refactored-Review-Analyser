// src/pages/PromptPage.tsx
import { useEffect, useState } from 'react'
import { Edit } from 'lucide-react'
import Editor from '@monaco-editor/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-3">
          <div className="p-3 rounded-full bg-primary/10 border border-primary/20">
            <Edit className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            LLM Prompt Editor
          </h1>
        </div>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Customize the AI analysis prompt to guide sentiment analysis and topic extraction.
        </p>
      </div>

      {/* Editor Card */}
      <Card className="border-2 border-primary/20 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <Edit className="h-5 w-5" />
            Prompt Configuration
          </CardTitle>
          <CardDescription>
            Edit the prompt that will be used for analyzing Steam reviews. 
            Use markdown formatting for better structure.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="border border-border rounded-lg overflow-hidden" style={{ height:'60vh' }}>
              <Editor
                height="100%"
                language="markdown"
                value={prompt}
                onChange={(value: string | undefined) => { 
                  setPrompt(value || ''); 
                  setDirty(true) 
                }}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  lineNumbers: 'on',
                  wordWrap: 'on',
                  padding: { top: 16, bottom: 16 }
                }}
              />
            </div>
            <div className="flex justify-end">
              <Button
                disabled={!dirty}
                onClick={save}
                className="px-6"
              >
                Save Prompt
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}