// src/pages/ResultsPage.tsx
import { useState, useEffect } from 'react'
import {
  Stack, Typography, Paper, Button, Select, MenuItem,
  FormControl, InputLabel, Chip, Box, Card, CardContent,
  Dialog, DialogTitle, DialogContent, DialogActions,
  IconButton, Tooltip
} from '@mui/material'
import {
  DataGrid,
  type GridColDef
} from '@mui/x-data-grid'
import { 
  Download, Visibility, Refresh,
  ThumbUp, ThumbDown, Star
} from '@mui/icons-material'
import { api } from '../api/ApiClient'
import { checkBackendStatus, type BackendStatus } from '../utils/backendStatus'

interface AnalyzedReview {
  id: number
  app_name: string
  app_id: number
  review_id: string
  author: string
  review_text: string
  voted_up: boolean
  votes_up: number
  votes_funny: number
  weighted_vote_score: number
  playtime_forever: number
  timestamp_created: number
  sentiment: string
  topics: string[]
  summary: string
  rating: number
}

interface ResultsFilter {
  app_id?: number
  sentiment?: string
  min_rating?: number
}

export default function ResultsPage() {
  const [reviews, setReviews] = useState<AnalyzedReview[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(25)
  const [selectedReview, setSelectedReview] = useState<AnalyzedReview | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [availableApps, setAvailableApps] = useState<{id: number, name: string}[]>([])
  const [filters, setFilters] = useState<ResultsFilter>({})
  const [backendStatus, setBackendStatus] = useState<BackendStatus>({
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

  // Load results when page/filters change (only if backend supports it)
  useEffect(() => {
    if (backendStatus.hasResultsEndpoint) {
      loadResults()
    }
  }, [page, pageSize, filters, backendStatus.hasResultsEndpoint])

  const loadAvailableApps = async () => {
    try {
      const response = await api.get('/results/apps')
      setAvailableApps(response.data)
    } catch (error) {
      console.error('Failed to load available apps:', error)
      // Set empty array as fallback
      setAvailableApps([])
    }
  }

  const loadResults = async () => {
    setLoading(true)
    try {
      const params = {
        page: page + 1,
        per_page: pageSize,
        ...filters
      }
      const response = await api.get('/results', { params })
      setReviews(response.data.results || [])
      setTotal(response.data.total || 0)
    } catch (error) {
      console.error('Failed to load results:', error)
      // Show empty state when API is not available
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

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment?.toLowerCase()) {
      case 'positive': return 'success'
      case 'negative': return 'error'
      case 'neutral': return 'default'
      default: return 'default'
    }
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString()
  }

  const formatPlaytime = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    return `${hours}h ${minutes % 60}m`
  }

  const columns: GridColDef[] = [
    { 
      field: 'app_name', 
      headerName: 'Game', 
      width: 200,
      renderCell: (params) => (
        <Box>
          <Typography variant="body2" fontWeight="bold">
            {params.value}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            ID: {params.row.app_id}
          </Typography>
        </Box>
      )
    },
    {
      field: 'author',
      headerName: 'Author',
      width: 150
    },
    {
      field: 'sentiment',
      headerName: 'Sentiment',
      width: 120,
      renderCell: (params) => (
        <Chip
          label={params.value}
          color={getSentimentColor(params.value) as any}
          size="small"
        />
      )
    },
    {
      field: 'rating',
      headerName: 'Rating',
      width: 100,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Star fontSize="small" color="primary" />
          <Typography variant="body2">{params.value}/5</Typography>
        </Box>
      )
    },
    {
      field: 'voted_up',
      headerName: 'Recommended',
      width: 120,
      renderCell: (params) => (
        params.value ? 
          <ThumbUp color="success" fontSize="small" /> : 
          <ThumbDown color="error" fontSize="small" />
      )
    },
    {
      field: 'playtime_forever',
      headerName: 'Playtime',
      width: 100,
      renderCell: (params) => formatPlaytime(params.value)
    },
    {
      field: 'timestamp_created',
      headerName: 'Date',
      width: 120,
      renderCell: (params) => formatDate(params.value)
    },
    {
      field: 'topics',
      headerName: 'Topics',
      width: 200,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {params.value?.slice(0, 2).map((topic: string, i: number) => (
            <Chip key={i} label={topic} size="small" variant="outlined" />
          ))}
          {params.value?.length > 2 && (
            <Chip label={`+${params.value.length - 2}`} size="small" />
          )}
        </Box>
      )
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 100,
      sortable: false,
      renderCell: (params) => (
        <Tooltip title="View Details">
          <IconButton
            size="small"
            onClick={() => {
              setSelectedReview(params.row)
              setDialogOpen(true)
            }}
          >
            <Visibility />
          </IconButton>
        </Tooltip>
      )
    }
  ]

  return (
    <Stack spacing={3}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4">Analysis Results</Typography>
        <Chip
          label={backendStatus.isConnected ? 'Backend Connected' : 'Backend Disconnected'}
          color={backendStatus.isConnected ? 'success' : 'error'}
          size="small"
        />
      </Box>

      {/* Filters and Actions */}
      <Card>
        <CardContent>
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
            <FormControl size="small" sx={{ minWidth: 200 }} disabled={!backendStatus.hasResultsAppsEndpoint}>
              <InputLabel>Filter by Game</InputLabel>
              <Select
                value={filters.app_id || ''}
                onChange={(e) => setFilters(prev => ({ 
                  ...prev, 
                  app_id: e.target.value || undefined 
                }))}
                label="Filter by Game"
              >
                <MenuItem value="">All Games</MenuItem>
                {availableApps.map(app => (
                  <MenuItem key={app.id} value={app.id}>
                    {app.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Sentiment</InputLabel>
              <Select
                value={filters.sentiment || ''}
                onChange={(e) => setFilters(prev => ({ 
                  ...prev, 
                  sentiment: e.target.value || undefined 
                }))}
                label="Sentiment"
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="positive">Positive</MenuItem>
                <MenuItem value="negative">Negative</MenuItem>
                <MenuItem value="neutral">Neutral</MenuItem>
              </Select>
            </FormControl>

            <Button
              variant="outlined"
              startIcon={<Refresh />}
              onClick={loadResults}
              disabled={!backendStatus.hasResultsEndpoint}
            >
              Refresh
            </Button>

            <Button
              variant="contained"
              startIcon={<Download />}
              onClick={() => handleExport('csv')}
              disabled={!backendStatus.hasResultsEndpoint}
            >
              Export CSV
            </Button>

            <Button
              variant="outlined"
              startIcon={<Download />}
              onClick={() => handleExport('json')}
              disabled={!backendStatus.hasResultsEndpoint}
            >
              Export JSON
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {/* Results Grid */}
      <Paper sx={{ height: 600, width: '100%' }}>
        {reviews.length === 0 && !loading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', p: 4 }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No Analysis Results Available
            </Typography>
            <Typography variant="body2" color="text.secondary" textAlign="center">
              The Results viewer will display analyzed reviews once you have:
              <br />• Added games using the App Finder
              <br />• Configured your analysis settings
              <br />• Run the analysis from the Dashboard
            </Typography>
          </Box>
        ) : (
          <DataGrid
            rows={reviews}
            columns={columns}
            rowCount={total}
            loading={loading}
            pagination
            paginationMode="server"
            paginationModel={{ page, pageSize }}
            onPaginationModelChange={(model) => {
              setPage(model.page)
              setPageSize(model.pageSize)
            }}
            pageSizeOptions={[10, 25, 50, 100]}
            disableRowSelectionOnClick
            getRowHeight={() => 80}
          />
        )}
      </Paper>

      {/* Review Detail Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Review Details</DialogTitle>
        <DialogContent>
          {selectedReview && (
            <Stack spacing={2}>
              <Box>
                <Typography variant="h6">{selectedReview.app_name}</Typography>
                <Typography variant="body2" color="text.secondary">
                  By {selectedReview.author} • {formatDate(selectedReview.timestamp_created)}
                </Typography>
              </Box>

              <Box>
                <Typography variant="subtitle2" gutterBottom>Review Text:</Typography>
                <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
                  <Typography variant="body2">
                    {selectedReview.review_text}
                  </Typography>
                </Paper>
              </Box>

              <Box>
                <Typography variant="subtitle2" gutterBottom>AI Analysis:</Typography>
                <Paper sx={{ p: 2, bgcolor: 'primary.50' }}>
                  <Typography variant="body2">
                    {selectedReview.summary}
                  </Typography>
                </Paper>
              </Box>

              <Box>
                <Typography variant="subtitle2" gutterBottom>Topics:</Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {selectedReview.topics?.map((topic, i) => (
                    <Chip key={i} label={topic} variant="outlined" />
                  ))}
                </Box>
              </Box>

              <Box sx={{ display: 'flex', gap: 2 }}>
                <Chip
                  label={selectedReview.sentiment}
                  color={getSentimentColor(selectedReview.sentiment) as any}
                />
                <Chip
                  icon={<Star />}
                  label={`${selectedReview.rating}/5`}
                  color="primary"
                  variant="outlined"
                />
                <Chip
                  label={`${selectedReview.votes_up} helpful`}
                  variant="outlined"
                />
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}