// src/pages/ResultsPage.tsx
import { useState, useEffect } from 'react'
import { BarChart3, RefreshCw, Download, AlertCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { api } from '../api/ApiClient'
import { checkBackendStatus } from '../utils/backendStatus'
import { SimpleReviewsTable } from '../components/SimpleReviewsTable'


interface ResultsFilter {
  app_id?: number
  sentiment?: string
  min_rating?: number
}

export default function ResultsPage() {
  const [reviews, setReviews] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [availableApps, setAvailableApps] = useState([])
  const [filters, setFilters] = useState({})
  const [backendStatus, setBackendStatus] = useState({
    isConnected: false,
    hasResultsEndpoint: false,
    hasResultsAppsEndpoint: false
  })

  // Check backend status and load data if endpoints exist
  useEffect(() => {
    const initializeResults = async () => {
      const status = await checkBackendStatus()
      setBackendStatus(status)
      
      if (status.hasResultsAppsEndpoint) {
        loadAvailableApps()
      }
      if (status.hasResultsEndpoint) {
        loadResults()
      }
    }
    
    initializeResults()
  }, [])

  // Load results when filters change (only if backend supports it)
  useEffect(() => {
    if (backendStatus.hasResultsEndpoint) {
      loadResults()
    }
  }, [filters, backendStatus.hasResultsEndpoint])

  const loadAvailableApps = async () => {
    try {
      const response = await api.get('/results/apps')
      setAvailableApps(response.data)
    } catch (error) {
      console.error('Failed to load available apps:', error)
      setAvailableApps([])
    }
  }

  const loadResults = async () => {
    setLoading(true)
    try {
      const params = {
        page: 1,
        per_page: 25,
        ...filters
      }
      const response = await api.get('/results', { params })
      setReviews(response.data.results || [])
      setTotal(response.data.total || 0)
    } catch (error) {
      console.error('Failed to load results:', error)
      setReviews([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async (format: 'csv' | 'json') => {
    try {
      const params = { format, ...filters }
      const response = await api.get('/results/export', { 
        params,
        responseType: 'blob'
      })
      
      const blob = new Blob([response.data])
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `reviews_export.${format}`
      link.click()
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Export failed:', error)
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-3">
          <div className="p-3 rounded-full bg-primary/10 border border-primary/20">
            <BarChart3 className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Analysis Results
          </h1>
        </div>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          View and analyze your Steam review data with powerful filtering options.
        </p>
      </div>

      {/* Status */}
      <Card className="border-2 border-primary/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              Backend Status
            </CardTitle>
            <Badge variant={backendStatus.isConnected ? "default" : "destructive"}>
              {backendStatus.isConnected ? 'Connected' : 'Disconnected'}
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Filters and Actions */}
      <Card className="border-2 border-primary/20 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-xl">Filters & Export</CardTitle>
          <CardDescription>
            Filter your results and export data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Filter by Game</label>
              <Select
                value={filters.app_id?.toString() || ''}
                onValueChange={(value) => setFilters(prev => ({ 
                  ...prev, 
                  app_id: value ? parseInt(value) : undefined 
                }))}
                disabled={!backendStatus.hasResultsAppsEndpoint}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Games" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Games</SelectItem>
                  {availableApps.map(app => (
                    <SelectItem key={app.id} value={app.id.toString()}>
                      {app.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Sentiment</label>
              <Select
                value={filters.sentiment || ''}
                onValueChange={(value) => setFilters(prev => ({ 
                  ...prev, 
                  sentiment: value || undefined 
                }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Sentiments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All</SelectItem>
                  <SelectItem value="positive">Positive</SelectItem>
                  <SelectItem value="negative">Negative</SelectItem>
                  <SelectItem value="neutral">Neutral</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              variant="outline"
              onClick={loadResults}
              disabled={!backendStatus.hasResultsEndpoint || loading}
              className="h-10"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              {loading ? 'Loading...' : 'Refresh'}
            </Button>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => handleExport('csv')}
                disabled={!backendStatus.hasResultsEndpoint}
                className="flex-1"
              >
                <Download className="h-4 w-4 mr-2" />
                CSV
              </Button>
              <Button
                variant="outline"
                onClick={() => handleExport('json')}
                disabled={!backendStatus.hasResultsEndpoint}
                className="flex-1"
              >
                <Download className="h-4 w-4 mr-2" />
                JSON
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Display */}
      <Card className="border border-border/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl">Analysis Results</CardTitle>
            <Badge variant="outline">
              {total} total reviews
            </Badge>
          </div>
          <CardDescription>
            {loading ? "Loading reviews..." : "Browse and analyze your Steam review data"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!backendStatus.hasResultsEndpoint ? (
            <div className="flex items-center justify-center py-16 text-center">
              <div className="space-y-4">
                <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto opacity-50" />
                <div>
                  <h3 className="text-lg font-semibold">Backend Not Available</h3>
                  <p className="text-muted-foreground mt-2 max-w-md">
                    The results endpoint is not available. Please ensure your backend is running.
                  </p>
                </div>
              </div>
            </div>
          ) : reviews.length === 0 && !loading ? (
            <div className="flex items-center justify-center py-16 text-center">
              <div className="space-y-4">
                <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto opacity-50" />
                <div>
                  <h3 className="text-lg font-semibold">No Analysis Results Available</h3>
                  <p className="text-muted-foreground mt-2 max-w-md">
                    The Results viewer will display analyzed reviews once you have:
                  </p>
                  <ul className="text-sm text-muted-foreground mt-3 space-y-1">
                    <li>• Added games using the Game Finder</li>
                    <li>• Configured your analysis settings</li>
                    <li>• Run the analysis from the Dashboard</li>
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <SimpleReviewsTable data={reviews} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}