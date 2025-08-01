// src/pages/FinderPage.tsx
import { useEffect, useState } from 'react'
import { Search, Plus, GamepadIcon, Check, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { searchApps, getConfig, setConfig } from '../api/ApiClient'
import { SelectedApps } from '../components/SelectedApps'
import { cn } from "@/lib/utils"

interface AppHit {
  appid: number
  name: string
}

export default function FinderPage() {
  const [query, setQuery] = useState<string>('')
  const [type, setType] = useState<'name' | 'id' | 'url'>('name')
  const [page, setPage] = useState<number>(0)
  const [perPage] = useState<number>(20)

  const [hits, setHits] = useState<AppHit[]>([])
  const [total, setTotal] = useState<number>(0)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [cfg, setCfg] = useState<any>(null)
  const [loading, setLoading] = useState(false)

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
  const doSearch = async (resetPage = true) => {
    if (!query.trim()) {
      toast.error("Please enter a search term")
      return
    }
    
    if (resetPage) {
      setPage(0)
    }
    
    setLoading(true)
    try {
      const currentPage = resetPage ? 1 : page + 1
      const res = await searchApps(query, type, currentPage, perPage) // API expects 1-based page
      setHits(res.data.results || [])
      setTotal(res.data.total || 0)
      setSelectedIds(new Set()) // Clear selection on new search
      
      if (res.data.results?.length === 0) {
        toast.info("No games found matching your search")
      } else {
        toast.success(`Found ${res.data.total || 0} games`)
      }
    } catch (error) {
      console.error('Failed to search apps:', error)
      setHits([])
      setTotal(0)
      setSelectedIds(new Set())
      toast.error("Failed to search games. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  // Handle pagination
  const goToPage = async (newPage: number) => {
    setPage(newPage)
    setLoading(true)
    try {
      const res = await searchApps(query, type, newPage + 1, perPage) // API expects 1-based page
      setHits(res.data.results || [])
      setSelectedIds(new Set()) // Clear selection on page change
    } catch (error) {
      console.error('Failed to load page:', error)
      toast.error("Failed to load page. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  // Handle individual checkbox toggle
  const handleToggleSelection = (appid: number, checked: boolean) => {
    const newSelection = new Set(selectedIds)
    if (checked) {
      newSelection.add(appid)
    } else {
      newSelection.delete(appid)
    }
    setSelectedIds(newSelection)
  }

  // Handle select all/none
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(hits.map(h => h.appid))) // Select all visible
    } else {
      setSelectedIds(new Set()) // Deselect all
    }
  }

  // Add selected App IDs to config
  const addSelected = async () => {
    if (!cfg || selectedIds.size === 0) return
    
    try {
      const currentApps = cfg.selected_apps || []
      const currentIds = new Set<number>(currentApps.map((app: any) => app.appid))
      
      const newApps = Array.from(selectedIds)
        .filter(id => !currentIds.has(id))
        .map(id => {
          const hit = hits.find(h => h.appid === id)
          return { appid: id, name: hit?.name || `Game ${id}` }
        })
      
      const updatedApps = [...currentApps, ...newApps]
      const newCfg = { 
        ...cfg, 
        selected_apps: updatedApps,
        app_ids: updatedApps.map((app: any) => app.appid) // Keep backward compatibility
      }
      
      await setConfig(newCfg)
      setCfg(newCfg)
      
      // Clear selection after successful add
      setSelectedIds(new Set())
      toast.success(`Added ${newApps.length} new game${newApps.length !== 1 ? 's' : ''} to your collection!`)
    } catch (error) {
      console.error('Failed to update config:', error)
      toast.error("Failed to add games to configuration")
    }
  }

  // Add single app to config
  const addSingleApp = async (app: AppHit) => {
    if (!cfg) return
    
    try {
      const currentApps = cfg.selected_apps || []
      const currentIds = new Set<number>(currentApps.map((a: any) => a.appid))
      
      if (currentIds.has(app.appid)) return // Already added
      
      const newApp = { appid: app.appid, name: app.name }
      const updatedApps = [...currentApps, newApp]
      const newCfg = { 
        ...cfg, 
        selected_apps: updatedApps,
        app_ids: updatedApps.map((a: any) => a.appid)
      }
      
      await setConfig(newCfg)
      setCfg(newCfg)
      
      toast.success(`Added "${app.name}" to your collection!`)
    } catch (error) {
      console.error('Failed to add app:', error)
      toast.error("Failed to add game to configuration")
    }
  }

  // Handle search on Enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      doSearch()
    }
  }

  const isAllSelected = hits.length > 0 && selectedIds.size === hits.length
  const isIndeterminate = selectedIds.size > 0 && selectedIds.size < hits.length
  const existingAppIds = new Set(cfg?.app_ids || [])
  
  // Get selected apps with proper names
  const selectedApps = cfg?.selected_apps || []
  
  // Calculate pagination info
  const totalPages = Math.ceil(total / perPage)
  const hasNextPage = page < totalPages - 1
  const hasPrevPage = page > 0

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 p-6">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Header Section */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3">
            <div className="p-3 rounded-full bg-primary/10 border border-primary/20">
              <GamepadIcon className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Steam Game Finder
            </h1>
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Discover and add Steam games to your analysis collection. Search by name, ID, or Steam URL.
          </p>
        </div>

        {/* Selected Apps Section */}
        <SelectedApps 
          apps={selectedApps}
          config={cfg}
          onConfigUpdate={setCfg}
        />

        {/* Search Section */}
        <Card className="border-2 border-primary/20 bg-card/50 backdrop-blur-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl flex items-center gap-2">
              <Search className="h-5 w-5" />
              Search Games
            </CardTitle>
            <CardDescription>
              Find Steam games to add to your review analysis
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <Input
                  placeholder="Enter game name, App ID, or Steam URL..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={loading}
                  className="h-12 text-base"
                />
              </div>
              
              <Select value={type} onValueChange={(value: 'name' | 'id' | 'url') => setType(value)}>
                <SelectTrigger className="w-full sm:w-48 h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">🎮 Game Name</SelectItem>
                  <SelectItem value="id">🔢 App ID</SelectItem>
                  <SelectItem value="url">🔗 Steam URL</SelectItem>
                </SelectContent>
              </Select>

              <Button 
                onClick={() => doSearch()}
                disabled={loading || !query.trim()}
                size="lg"
                className="h-12 px-8 steam-gradient hover:opacity-90 transition-opacity"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4 mr-2" />
                    Search
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results Section */}
        {hits.length > 0 && (
          <Card className="border border-border/50 bg-card/80 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <div>
                <CardTitle className="text-xl">Search Results</CardTitle>
                <CardDescription>
                  Found {total} games • {hits.length} shown
                </CardDescription>
              </div>
              
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-4">
                  <Badge variant="secondary" className="text-sm">
                    {selectedIds.size} selected
                  </Badge>
                  <Button
                    onClick={addSelected}
                    className="steam-gradient hover:opacity-90"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add to Collection
                  </Button>
                </div>
              )}
            </CardHeader>
            
            <CardContent className="p-0">
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={isAllSelected}
                          onCheckedChange={handleSelectAll}
                          aria-label="Select all games"
                          className={cn(
                            isIndeterminate && "data-[state=checked]:bg-primary/50"
                          )}
                        />
                      </TableHead>
                      <TableHead className="w-32">App ID</TableHead>
                      <TableHead>Game Name</TableHead>
                      <TableHead className="w-32 text-center">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                </Table>
                <div className="max-h-[400px] overflow-y-auto">
                  <Table>
                    <TableBody>
                    {hits.map((app) => {
                      const isSelected = selectedIds.has(app.appid)
                      const isInCollection = existingAppIds.has(app.appid)
                      
                      return (
                        <TableRow 
                          key={app.appid} 
                          className={cn(
                            "game-card-hover",
                            isSelected && "bg-primary/5",
                            isInCollection && "bg-green-500/5"
                          )}
                        >
                          <TableCell>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={(checked) => 
                                handleToggleSelection(app.appid, checked as boolean)
                              }
                              disabled={isInCollection}
                              aria-label={`Select ${app.name}`}
                            />
                          </TableCell>
                          <TableCell>
                            <code className="text-sm bg-muted px-2 py-1 rounded">
                              {app.appid}
                            </code>
                          </TableCell>
                          <TableCell className="font-medium">
                            {app.name}
                          </TableCell>
                          <TableCell className="text-center">
                            {isInCollection ? (
                              <Badge variant="secondary" className="bg-green-500/10 text-green-600 dark:text-green-400">
                                <Check className="h-3 w-3 mr-1" />
                                In Collection
                              </Badge>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => addSingleApp(app)}
                                className="h-7 px-3 text-xs hover:bg-primary/10 hover:text-primary hover:border-primary/50"
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                Add
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                    </TableBody>
                  </Table>
                </div>
              </div>
              
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Page {page + 1} of {totalPages} • {total} total games
                  </p>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => goToPage(page - 1)}
                      disabled={!hasPrevPage || loading}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        const pageNum = page < 3 ? i : page - 2 + i
                        if (pageNum >= totalPages) return null
                        
                        return (
                          <Button
                            key={pageNum}
                            variant={pageNum === page ? "default" : "outline"}
                            size="sm"
                            onClick={() => goToPage(pageNum)}
                            disabled={loading}
                            className="h-8 w-8 p-0 text-xs"
                          >
                            {pageNum + 1}
                          </Button>
                        )
                      })}
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => goToPage(page + 1)}
                      disabled={!hasNextPage || loading}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {!loading && hits.length === 0 && query && (
          <Card className="border-dashed border-2 border-muted-foreground/25">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="p-4 rounded-full bg-muted/50 mb-4">
                <X className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No games found</h3>
              <p className="text-muted-foreground mb-4 max-w-sm">
                Try adjusting your search terms or search type to find the games you're looking for.
              </p>
              <Button variant="outline" onClick={() => setQuery('')}>
                Clear Search
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}