// src/pages/PromptPage.tsx
import { useEffect, useState, useRef } from 'react'
import { 
  Edit, 
  Save, 
  FileText, 
  AlertCircle, 
  CheckCircle, 
  Upload,
  Trash2,
  Plus,
  Download,
  Clock,
  Eye,
  RotateCcw,
  FileCheck
} from 'lucide-react'
import Editor from '@monaco-editor/react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  getPrompts, 
  getPrompt, 
  savePrompt, 
  selectPrompt, 
  uploadPrompt, 
  deletePrompt 
} from '../api/ApiClient'

interface PromptFile {
  filename: string
  size: number
  modified: number
  preview: string
  is_active: boolean
}

export default function PromptPage() {
  const [prompt, setPrompt] = useState('')
  const [originalPrompt, setOriginalPrompt] = useState('')
  const [currentFilename, setCurrentFilename] = useState('')
  const [dirty, setDirty] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  
  // Prompt file management state
  const [promptFiles, setPromptFiles] = useState<PromptFile[]>([])
  const [activePromptFile, setActivePromptFile] = useState('')
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [fileToDelete, setFileToDelete] = useState('')
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadPrompts()
  }, [])

  const loadPrompts = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await getPrompts()
      setPromptFiles(response.data.prompts)
      setActivePromptFile(response.data.active_prompt)
      
      // Load the current prompt content
      await loadCurrentPrompt()
    } catch (err: any) {
      setError(`Failed to load prompts: ${err.response?.data?.detail || err.message}`)
      toast.error(`Failed to load prompts: ${err.response?.data?.detail || err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const loadCurrentPrompt = async () => {
    try {
      const response = await getPrompt()
      const content = response.data.content
      const filename = response.data.filename
      setPrompt(content)
      setOriginalPrompt(content)
      setCurrentFilename(filename)
      setDirty(false)
    } catch (err: any) {
      setError(`Failed to load current prompt: ${err.response?.data?.detail || err.message}`)
    }
  }

  const handlePromptChange = (value: string | undefined) => {
    const newValue = value || ''
    setPrompt(newValue)
    setDirty(newValue !== originalPrompt)
    if (success) setSuccess(false)
    if (error) setError(null)
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
      toast.success(`Saved changes to ${currentFilename}`)
      
      // Refresh the prompt list to update modification times
      loadPrompts()
      
      // Hide success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000)
    } catch (err: any) {
      const errorMsg = `Failed to save prompt: ${err.response?.data?.detail || err.message}`
      setError(errorMsg)
      toast.error(errorMsg)
    } finally {
      setSaving(false)
    }
  }

  const handleSelectPrompt = async (filename: string) => {
    if (dirty) {
      const confirmSwitch = window.confirm(
        'You have unsaved changes. Do you want to save them before switching prompts?'
      )
      if (confirmSwitch) {
        await save()
      }
    }

    try {
      await selectPrompt(filename)
      setActivePromptFile(filename)
      await loadCurrentPrompt()
      toast.success(`Switched to prompt: ${filename}`)
      
      // Refresh the prompt list
      loadPrompts()
    } catch (err: any) {
      const errorMsg = `Failed to select prompt: ${err.response?.data?.detail || err.message}`
      setError(errorMsg)
      toast.error(errorMsg)
    }
  }

  const handleUpload = async (file: File) => {
    try {
      setUploading(true)
      const response = await uploadPrompt(file)
      const uploadedFilename = response.data.filename
      
      toast.success(`Uploaded ${uploadedFilename} successfully`)
      
      // Refresh the prompt list
      await loadPrompts()
      
      // Optionally switch to the newly uploaded prompt
      const switchToNew = window.confirm(
        `Would you like to switch to the newly uploaded prompt: ${uploadedFilename}?`
      )
      if (switchToNew) {
        await handleSelectPrompt(uploadedFilename)
      }
      
      setUploadDialogOpen(false)
    } catch (err: any) {
      const errorMsg = `Failed to upload prompt: ${err.response?.data?.detail || err.message}`
      setError(errorMsg)
      toast.error(errorMsg)
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (filename: string) => {
    try {
      await deletePrompt(filename)
      toast.success(`Deleted ${filename}`)
      
      // Refresh the prompt list
      await loadPrompts()
      
      setDeleteDialogOpen(false)
      setFileToDelete('')
    } catch (err: any) {
      const errorMsg = `Failed to delete prompt: ${err.response?.data?.detail || err.message}`
      setError(errorMsg)
      toast.error(errorMsg)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="space-y-4 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mx-auto" />
          <p className="text-muted-foreground">Loading prompts...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full bg-primary/10 border border-primary/20">
              <Edit className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Prompt Management
            </h1>
          </div>
          <p className="text-lg text-muted-foreground">
            Create, edit, and manage analysis prompts for your LLM models.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          {dirty && (
            <Badge variant="secondary" className="px-3 py-1">
              Unsaved changes
            </Badge>
          )}
          <Button
            variant="outline"
            onClick={loadPrompts}
            disabled={saving}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            onClick={save}
            disabled={!dirty || saving}
            className="steam-gradient hover:opacity-90"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Left Column - File Management */}
        <div className="lg:col-span-1 space-y-6">
          {/* Active Prompt Selector */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileCheck className="h-5 w-5" />
                  Active Prompt
                </CardTitle>
                <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline">
                      <Upload className="h-4 w-4 mr-2" />
                      Upload
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Upload Prompt File</DialogTitle>
                      <DialogDescription>
                        Upload a new .txt prompt file to add to your collection.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="file-upload">Select File</Label>
                        <Input
                          id="file-upload"
                          type="file"
                          accept=".txt"
                          ref={fileInputRef}
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) {
                              handleUpload(file)
                            }
                          }}
                        />
                        <p className="text-xs text-muted-foreground mt-2">
                          Only .txt files are supported
                        </p>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button 
                        variant="outline" 
                        onClick={() => setUploadDialogOpen(false)}
                        disabled={uploading}
                      >
                        Cancel
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value={activePromptFile} onValueChange={handleSelectPrompt}>
                <SelectTrigger>
                  <SelectValue placeholder="Select prompt file" />
                </SelectTrigger>
                <SelectContent>
                  {promptFiles.map((file) => (
                    <SelectItem key={file.filename} value={file.filename}>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        {file.filename}
                        {file.is_active && (
                          <Badge variant="secondary" className="text-xs">
                            Active
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {currentFilename && (
                <div className="text-sm text-muted-foreground">
                  Currently editing: <span className="font-medium">{currentFilename}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Prompt Files List */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Prompt Files ({promptFiles.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {promptFiles.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No prompt files found</p>
                </div>
              ) : (
                promptFiles.map((file) => (
                  <div
                    key={file.filename}
                    className={`p-3 rounded-lg border transition-colors ${
                      file.is_active ? 'bg-primary/5 border-primary/20' : 'bg-card/50'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-sm truncate">
                            {file.filename}
                          </p>
                          {file.is_active && (
                            <Badge variant="secondary" className="text-xs">
                              Active
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{formatFileSize(file.size)}</span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDate(file.modified)}
                          </span>
                        </div>
                      </div>
                      
                      {file.filename !== 'prompt.txt' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setFileToDelete(file.filename)
                            setDeleteDialogOpen(true)
                          }}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    
                    {file.preview && (
                      <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded border">
                        <div className="flex items-center gap-1 mb-1">
                          <Eye className="h-3 w-3" />
                          Preview:
                        </div>
                        <p className="line-clamp-2">{file.preview}</p>
                      </div>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Editor */}
        <div className="lg:col-span-3 space-y-6">
          {/* Status Alerts */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-900/50 dark:text-green-200">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>Prompt saved successfully!</AlertDescription>
            </Alert>
          )}

          {/* Editor */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Edit className="h-5 w-5" />
                    Prompt Editor
                  </CardTitle>
                  <CardDescription>
                    Edit your analysis prompt. Changes will be saved to {currentFilename || 'the active prompt file'}.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {dirty && (
                    <Badge variant="outline" className="text-xs">
                      Modified
                    </Badge>
                  )}
                  <Badge variant="secondary" className="text-xs">
                    {prompt.length} characters
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden">
                <Editor
                  height="500px"
                  defaultLanguage="markdown"
                  value={prompt}
                  onChange={handlePromptChange}
                  options={{
                    minimap: { enabled: false },
                    wordWrap: 'on',
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    fontSize: 14,
                    lineHeight: 1.5,
                    padding: { top: 16, bottom: 16 },
                  }}
                  theme="vs-dark"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Prompt File</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{fileToDelete}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setDeleteDialogOpen(false)
                setFileToDelete('')
              }}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => handleDelete(fileToDelete)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}