// src/pages/FinderPage.tsx
import { useEffect, useState } from 'react'
import {
  TextField,
  Button,
  Select,
  MenuItem,
  Typography,
  Stack,
  Alert,
  Snackbar
} from '@mui/material'
import {
  DataGrid,
  type GridColDef,
  type GridPaginationModel
} from '@mui/x-data-grid'
import { searchApps, getConfig, setConfig } from '../api/ApiClient'

interface AppHit {
  appid: number
  name: string
}

export default function FinderPage() {
  const [query, setQuery] = useState<string>('')
  const [type, setType] = useState<'name' | 'id' | 'url'>('name')
  const [page, setPage] = useState<number>(1)
  const [perPage, setPerPage] = useState<number>(20)

  const [hits, setHits] = useState<AppHit[]>([])
  const [total, setTotal] = useState<number>(0)
  const [selection, setSelection] = useState<number[]>([])
  const [cfg, setCfg] = useState<any>(null)
  const [showSuccess, setShowSuccess] = useState(false)

  // Load existing config (for app_ids)
  useEffect(() => {
    getConfig()
      .then((res) => setCfg(res.data))
      .catch((error) => {
        console.error('Failed to load config:', error)
        setCfg({}) // Set empty config as fallback
      })
  }, [])

  // Perform search
  const doSearch = async () => {
    try {
      const res = await searchApps(query, type, page, perPage)
      setHits(res.data.results || [])
      setTotal(res.data.total || 0)
      setSelection([])
    } catch (error) {
      console.error('Failed to search apps:', error)
      setHits([])
      setTotal(0)
      setSelection([])
    }
  }

  // Add selected App IDs to config
  const addSelected = async () => {
    if (!cfg || !selection || selection.length === 0) return
    
    try {
    const current = new Set<number>(cfg.app_ids || [])
      
      // selection is now always an array of numbers
      selection.forEach((id) => current.add(Number(id)))
      
    const newCfg = { ...cfg, app_ids: Array.from(current) }
      await setConfig(newCfg)
      setCfg(newCfg)
      
      // Clear selection after successful add
      setSelection([])
      setShowSuccess(true)
    } catch (error) {
      console.error('Failed to update config:', error)
  }
  }

  // Define columns
  const columns: GridColDef[] = [
    { field: 'appid', headerName: 'App ID', width: 120 },
    { field: 'name', headerName: 'Name', flex: 1 }
  ]

  // Controlled pagination model
  const paginationModel: GridPaginationModel = {
    page: page - 1,
    pageSize: perPage
  }

  return (
    <Stack spacing={3}>
      <Typography variant="h4">App ID Finder</Typography>

      {/* Search controls */}
      <Stack direction="row" spacing={2}>
        <TextField
          label="Search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && doSearch()}
        />

        <Select
          value={type}
          onChange={(e) => setType(e.target.value as 'name' | 'id' | 'url')}
        >
          <MenuItem value="name">Game Name</MenuItem>
          <MenuItem value="id">App ID</MenuItem>
          <MenuItem value="url">Steam URL</MenuItem>
        </Select>

        <Button variant="contained" onClick={doSearch}>
          Search
        </Button>
      </Stack>

      {/* Results grid */}
      <div style={{ flex: 1, minHeight: 400 }}>
        <DataGrid
          rows={hits.map((h) => ({ id: h.appid, ...h }))}
          columns={columns}
          rowCount={total}
          pagination
          paginationMode="server"
          paginationModel={paginationModel}
          onPaginationModelChange={(
            model: GridPaginationModel
          ) => {
            setPage(model.page + 1)
            setPerPage(model.pageSize)
          }}
          checkboxSelection
          disableRowSelectionOnClick
          rowSelectionModel={selection as any}
          onRowSelectionModelChange={(newSelection) => {
            // Convert GridRowSelectionModel to number array
            console.log('DataGrid selection changed:', newSelection, typeof newSelection)
            
            let selectedIds: any[] = []
            if (Array.isArray(newSelection)) {
              selectedIds = newSelection
            } else if (newSelection && typeof newSelection === 'object') {
              // Handle Set-like objects or objects with iterator
              if ('forEach' in newSelection) {
                (newSelection as any).forEach((id: any) => selectedIds.push(id))
              } else if (Symbol.iterator in newSelection) {
                selectedIds = Array.from(newSelection as any)
              }
            }
            
            const numericIds = selectedIds.map(id => Number(id))
            console.log('Converted to numeric IDs:', numericIds)
            setSelection(numericIds)
          }}
        />
      </div>

      {/* Bulk add button */}
      <Button
        variant="contained"
        disabled={!selection || selection.length === 0}
        onClick={addSelected}
      >
        ➕ Add Selected
      </Button>

      {/* Success notification */}
      <Snackbar
        open={showSuccess}
        autoHideDuration={3000}
        onClose={() => setShowSuccess(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" onClose={() => setShowSuccess(false)}>
          Selected apps added to configuration successfully!
        </Alert>
      </Snackbar>
    </Stack>
  )
}