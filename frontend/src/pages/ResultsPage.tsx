// src/pages/ResultsPage.tsx
import { useState, useEffect } from 'react'
import { BarChart3, RefreshCw, FolderOpen, AlertCircle, FileText, Database } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { getResultsFiles, getResultsFileContent, openResultsFolder } from '../api/ApiClient'
import { SimpleReviewsTable } from '../components/SimpleReviewsTable'

interface ResultFile {
  filename: string
  path: string
  size: number
  modified: number
  type: 'raw' | 'analysed' | 'summary'
}

interface FileContent {
  filename: string
  type: string
  total_rows?: number
  columns?: string[]
  data: any[]
}

export default function ResultsPage() {
  const [allFiles, setAllFiles] = useState<{
    raw_files: ResultFile[]
    analysed_files: ResultFile[]
    summary_files: ResultFile[]
  }>({
    raw_files: [],
    analysed_files: [],
    summary_files: []
  })
  const [selectedFile, setSelectedFile] = useState<string>('')
  const [currentFileContent, setCurrentFileContent] = useState<FileContent | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingContent, setLoadingContent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadAvailableFiles()
  }, [])

  useEffect(() => {
    if (selectedFile) {
      loadFileContent(selectedFile)
    } else {
      setCurrentFileContent(null)
    }
  }, [selectedFile])

  const loadAvailableFiles = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await getResultsFiles()
      setAllFiles(response.data)
      
      // Auto-select first available file
      const allAvailableFiles = [
        ...response.data.analysed_files,
        ...response.data.raw_files,
        ...response.data.summary_files
      ]
      if (allAvailableFiles.length > 0 && !selectedFile) {
        const firstFile = allAvailableFiles[0]
        setSelectedFile(`${firstFile.type}:${firstFile.filename}`)
      }
      
    } catch (err: any) {
      setError(`Failed to load files: ${err.response?.data?.detail || err.message}`)
    } finally {
      setLoading(false)
    }
  }

  const loadFileContent = async (fileKey: string) => {
    try {
      setLoadingContent(true)
      setError(null)
      
      const [fileType, filename] = fileKey.split(':')
      if (!fileType || !filename) return
      
      const response = await getResultsFileContent(fileType, filename, 1000) // Load first 1000 rows
      setCurrentFileContent(response.data)
      
    } catch (err: any) {
      setError(`Failed to load file content: ${err.response?.data?.detail || err.message}`)
      setCurrentFileContent(null)
    } finally {
      setLoadingContent(false)
    }
  }

  const handleOpenFolder = async () => {
    try {
      await openResultsFolder()
    } catch (err: any) {
      setError(`Failed to open folder: ${err.response?.data?.detail || err.message}`)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatFileDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString() + ' ' + 
           new Date(timestamp * 1000).toLocaleTimeString()
  }

  const getAllFiles = () => {
    return [
      ...allFiles.analysed_files.map(f => ({ ...f, displayName: `📊 ${f.filename} (Analysed)` })),
      ...allFiles.raw_files.map(f => ({ ...f, displayName: `📋 ${f.filename} (Raw)` })),
      ...allFiles.summary_files.map(f => ({ ...f, displayName: `📈 ${f.filename} (Summary)` }))
    ]
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mx-auto"></div>
          <p className="text-muted-foreground">Loading results files...</p>
        </div>
      </div>
    )
  }

  const availableFiles = getAllFiles()

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-3">
          <div className="p-3 rounded-full bg-primary/10 border border-primary/20">
            <Database className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Analysis Results
          </h1>
        </div>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Browse and analyze your generated CSV files and analysis results.
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* File Selection and Actions */}
      <Card className="border-2 border-primary/20 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                <FileText className="h-5 w-5" />
                File Browser
              </CardTitle>
              <CardDescription>
                Select and view analysis result files
              </CardDescription>
            </div>
            <Button 
              variant="outline" 
              onClick={handleOpenFolder}
              className="flex items-center gap-2"
            >
              <FolderOpen className="h-4 w-4" />
              Open Output Folder
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select File</label>
              <Select 
                value={selectedFile} 
                onValueChange={setSelectedFile}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose a file to view..." />
                </SelectTrigger>
                <SelectContent>
                  {availableFiles.length === 0 ? (
                    <SelectItem value="no-files" disabled>
                      No files available
                    </SelectItem>
                  ) : (
                    availableFiles.map((file) => (
                      <SelectItem 
                        key={`${file.type}:${file.filename}`} 
                        value={`${file.type}:${file.filename}`}
                      >
                        {file.displayName}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            
            <Button
              variant="outline"
              onClick={() => loadAvailableFiles()}
              disabled={loading}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh Files
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* File Info */}
      {selectedFile && currentFileContent && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">{currentFileContent.filename}</CardTitle>
                <CardDescription className="flex items-center gap-4 mt-1">
                  <span>Type: {currentFileContent.type}</span>
                  {currentFileContent.total_rows && (
                    <span>Rows: {currentFileContent.total_rows.toLocaleString()}</span>
                  )}
                  {currentFileContent.columns && (
                    <span>Columns: {currentFileContent.columns.length}</span>
                  )}
                </CardDescription>
              </div>
              <Badge variant="outline" className="capitalize">
                {currentFileContent.type}
              </Badge>
            </div>
          </CardHeader>
        </Card>
      )}

      {/* Results Display */}
      <Card className="border border-border/50">
        <CardHeader>
          <CardTitle className="text-xl">File Content</CardTitle>
          <CardDescription>
            {loadingContent ? "Loading file content..." : 
             currentFileContent ? `Displaying content from ${currentFileContent.filename}` :
             "Select a file to view its content"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingContent ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center space-y-4">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mx-auto"></div>
                <p className="text-muted-foreground">Loading file content...</p>
              </div>
            </div>
          ) : !selectedFile ? (
            <div className="flex items-center justify-center py-16 text-center">
              <div className="space-y-4">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto opacity-50" />
                <div>
                  <h3 className="text-lg font-semibold">No File Selected</h3>
                  <p className="text-muted-foreground mt-2 max-w-md">
                    {availableFiles.length === 0 
                      ? "No result files are available. Run an analysis first to generate data."
                      : "Select a file from the dropdown above to view its content."}
                  </p>
                </div>
              </div>
            </div>
          ) : !currentFileContent ? (
            <div className="flex items-center justify-center py-16 text-center">
              <div className="space-y-4">
                <AlertCircle className="h-12 w-12 text-red-500 mx-auto opacity-50" />
                <div>
                  <h3 className="text-lg font-semibold">Failed to Load File</h3>
                  <p className="text-muted-foreground mt-2 max-w-md">
                    Could not load the selected file. It may be corrupted or inaccessible.
                  </p>
                </div>
              </div>
            </div>
          ) : currentFileContent.type === 'summary' ? (
            <div className="space-y-4">
              <pre className="bg-muted p-4 rounded-lg overflow-auto max-h-96 text-sm">
                {JSON.stringify(currentFileContent.data, null, 2)}
              </pre>
            </div>
          ) : (
            <SimpleReviewsTable data={currentFileContent.data} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}