// src/pages/PromptPage.tsx
import { useEffect, useState } from 'react'
import { Edit, Save, FileText, AlertCircle, CheckCircle } from 'lucide-react'
import Editor from '@monaco-editor/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { getPrompt, savePrompt } from '../api/ApiClient'

export default function PromptPage() {
  const [prompt, setPrompt] = useState('')
  const [originalPrompt, setOriginalPrompt] = useState('')
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    loadPrompt()
  }, [])

  const loadPrompt = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await getPrompt()
      const content = response.data.content
      setPrompt(content)
      setOriginalPrompt(content)
      setDirty(false)
    } catch (err: any) {
      setError(`Failed to load prompt: ${err.response?.data?.detail || err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const save = async () => {
    try {
      setSaving(true)
      setError(null)
      setSuccess(false)
      
      await savePrompt(prompt)
      
      setOriginalPrompt(prompt)
      setDirty(false)
      setSuccess(true)
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: any) {
      setError(`Failed to save prompt: ${err.response?.data?.detail || err.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handlePromptChange = (value: string | undefined) => {
    const newValue = value || ''
    setPrompt(newValue)
    setDirty(newValue !== originalPrompt)
    setError(null)
    setSuccess(false)
  }

  const resetChanges = () => {
    setPrompt(originalPrompt)
    setDirty(false)
    setError(null)
    setSuccess(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mx-auto"></div>
          <p className="text-muted-foreground">Loading prompt...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-3">
          <div className="p-3 rounded-full bg-primary/10 border border-primary/20">
            <FileText className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            LLM Prompt Editor
          </h1>
        </div>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Customize the AI analysis prompt used for analyzing Steam reviews. This prompt guides how the AI will interpret and categorize review content.
        </p>
      </div>

      {/* Status Messages */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="border-green-200 bg-green-50 text-green-800">
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>Prompt saved successfully!</AlertDescription>
        </Alert>
      )}

      {/* Editor Card */}
      <Card className="border-2 border-primary/20 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                <Edit className="h-5 w-5" />
                Prompt Configuration
              </CardTitle>
              <CardDescription>
                Edit the prompt that will be used for analyzing Steam reviews. The prompt should guide the AI to extract meaningful insights from user reviews.
              </CardDescription>
            </div>
            {dirty && (
              <div className="text-sm text-muted-foreground bg-yellow-50 border border-yellow-200 rounded px-3 py-1">
                Unsaved changes
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="border border-border rounded-lg overflow-hidden" style={{ height:'60vh' }}>
              <Editor
                height="100%"
                language="markdown"
                value={prompt}
                onChange={handlePromptChange}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  lineNumbers: 'on',
                  wordWrap: 'on',
                  padding: { top: 16, bottom: 16 },
                  automaticLayout: true,
                  scrollBeyondLastLine: false
                }}
              />
            </div>
            
            {/* Action Buttons */}
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {prompt.length} characters • {prompt.split('\n').length} lines
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  disabled={!dirty}
                  onClick={resetChanges}
                >
                  Reset Changes
                </Button>
                <Button
                  disabled={!dirty || saving}
                  onClick={save}
                  className="px-6"
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Prompt
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Help Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Prompt Guidelines</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>• <strong>Be specific:</strong> Clearly define what insights you want to extract from reviews</p>
          <p>• <strong>Use examples:</strong> Provide examples of the type of analysis you're looking for</p>
          <p>• <strong>Structure output:</strong> Specify the format you want the AI to return results in</p>
          <p>• <strong>Set boundaries:</strong> Define what the AI should and shouldn't focus on</p>
          <p>• <strong>Test iteratively:</strong> Run small tests and refine your prompt based on results</p>
        </CardContent>
      </Card>
    </div>
  )
}