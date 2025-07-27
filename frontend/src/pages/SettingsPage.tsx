// src/pages/SettingsPage.tsx
import { useEffect, useState } from 'react'
import {
  Button, TextField, Checkbox, FormControlLabel, Select, MenuItem,
  Typography, Stack, Card, CardContent,
  Chip, Box, FormControl, InputLabel, Alert, Accordion,
  AccordionSummary, AccordionDetails
} from '@mui/material'
import { Save, RestoreFromTrash, ExpandMore } from '@mui/icons-material'
import { getConfig, setConfig } from '../api/ApiClient'

interface FullConfig { [key:string]: any }

export default function SettingsPage() {
  const [cfg, setCfg] = useState<FullConfig|null>(null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getConfig().then(r => setCfg(r.data))
  }, [])

  if (!cfg) return <div>Loading configuration...</div>

  const onFieldChange = (path: string, value: any) => {
    const next = JSON.parse(JSON.stringify(cfg))
    path.split('.').reduce((o,k,i,arr) => {
      if (i === arr.length-1) o[k]=value
      return o[k]
    }, next)
    setCfg(next); setDirty(true)
  }

  const save = async () => {
    setSaving(true)
    try {
      await setConfig(cfg!)
      setDirty(false)
    } catch (error) {
      console.error('Failed to save config:', error)
    } finally {
      setSaving(false)
    }
  }

  const resetToDefaults = () => {
    // Reset to default values - you would typically get these from the backend
    const defaults = {
      ...cfg,
      fetching: {
        reviews_per_app: 100,
        max_requests_per_app: 10,
        enable_complete_scraping: false,
        min_playtime_hours: 0.5,
        filter_by_language: true,
        target_language: 'english'
      },
      analysis: {
        reviews_to_analyze: 50,
        skip_scraping: false,
        enable_sentiment_analysis: true,
        enable_topic_modeling: true,
        max_topics: 10
      }
    }
    setCfg(defaults)
    setDirty(true)
  }

  return (
    <Stack spacing={3}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4">Configuration Settings</Typography>
        <Stack direction="row" spacing={2}>
          <Button
            variant="outlined"
            startIcon={<RestoreFromTrash />}
            onClick={resetToDefaults}
          >
            Reset to Defaults
          </Button>
          <Button
            variant="contained"
            startIcon={<Save />}
            disabled={!dirty || saving}
            onClick={save}
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </Stack>
      </Box>

      {dirty && (
        <Alert severity="warning">
          You have unsaved changes. Don't forget to save your configuration.
        </Alert>
      )}

      {/* App Selection */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography variant="h6">Selected Apps</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Currently selected Steam applications for analysis:
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
                {cfg.app_ids && cfg.app_ids.length > 0 ? (
                  cfg.app_ids.map((id: number) => (
                    <Chip 
                      key={id} 
                      label={`App ID: ${id}`} 
                      onDelete={() => {
                        const newIds = cfg.app_ids.filter((appId: number) => appId !== id)
                        onFieldChange('app_ids', newIds)
                      }}
                    />
                  ))
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No apps selected. Use the App Finder to add games for analysis.
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        </AccordionDetails>
      </Accordion>

      {/* Fetching Settings */}
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography variant="h6">Data Fetching & Filtering</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={3}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              fullWidth
              label="Reviews per App"
              type="number"
                value={cfg.fetching?.reviews_per_app || 100}
                onChange={e => onFieldChange('fetching.reviews_per_app', +e.target.value)}
                helperText="Maximum number of reviews to fetch per game"
              />
            <TextField
              fullWidth
              label="Max Requests per App"
              type="number"
                value={cfg.fetching?.max_requests_per_app || 10}
                onChange={e => onFieldChange('fetching.max_requests_per_app', +e.target.value)}
                helperText="API request limit to prevent rate limiting"
            />
            </Stack>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField
                fullWidth
                label="Minimum Playtime (hours)"
                type="number"
                slotProps={{ htmlInput: { step: "0.1" } }}
                value={cfg.fetching?.min_playtime_hours || 0.5}
                onChange={e => onFieldChange('fetching.min_playtime_hours', +e.target.value)}
                helperText="Filter reviews by minimum playtime"
              />
              <FormControl fullWidth>
                <InputLabel>Target Language</InputLabel>
                <Select
                  value={cfg.fetching?.target_language || 'english'}
                  onChange={e => onFieldChange('fetching.target_language', e.target.value)}
                  label="Target Language"
                >
                  <MenuItem value="english">English</MenuItem>
                  <MenuItem value="spanish">Spanish</MenuItem>
                  <MenuItem value="french">French</MenuItem>
                  <MenuItem value="german">German</MenuItem>
                  <MenuItem value="all">All Languages</MenuItem>
                </Select>
              </FormControl>  
            </Stack>
            <Stack spacing={2}>
            <FormControlLabel
              control={
                <Checkbox
                    checked={cfg.fetching?.enable_complete_scraping || false}
                    onChange={(_, v) => onFieldChange('fetching.enable_complete_scraping', v)}
                />
              }
                label="Enable Complete Scraping (fetch all available reviews)"
            />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={cfg.fetching?.filter_by_language || true}
                    onChange={(_, v) => onFieldChange('fetching.filter_by_language', v)}
                  />
                }
                label="Filter reviews by selected language"
              />
            </Stack>
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* Analysis Settings */}
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography variant="h6">AI Analysis Configuration</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={3}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
            <TextField
              fullWidth
              label="Reviews to Analyze"
              type="number"
                value={cfg.analysis?.reviews_to_analyze || 50}
                onChange={e => onFieldChange('analysis.reviews_to_analyze', +e.target.value)}
                helperText="Number of reviews to process with AI"
              />
              <TextField
                fullWidth
                label="Max Topics to Extract"
                type="number"
                value={cfg.analysis?.max_topics || 10}
                onChange={e => onFieldChange('analysis.max_topics', +e.target.value)}
                helperText="Maximum number of topics to identify per review"
              />
            </Stack>
            <Stack spacing={2}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={cfg.analysis?.skip_scraping || false}
                    onChange={(_,v) => onFieldChange('analysis.skip_scraping', v)}
                  />
                }
                label="Skip scraping phase (analyze existing data only)"
            />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={cfg.analysis?.enable_sentiment_analysis !== false}
                    onChange={(_,v) => onFieldChange('analysis.enable_sentiment_analysis', v)}
                  />
                }
                label="Enable sentiment analysis"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={cfg.analysis?.enable_topic_modeling !== false}
                    onChange={(_,v) => onFieldChange('analysis.enable_topic_modeling', v)}
                  />
                }
                label="Enable topic modeling and extraction"
              />
            </Stack>
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* LLM Settings */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography variant="h6">LLM Configuration</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={3}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <FormControl fullWidth>
                <InputLabel>LLM Provider</InputLabel>
                <Select
                  value={cfg.llm?.provider || 'openai'}
                  onChange={e => onFieldChange('llm.provider', e.target.value)}
                  label="LLM Provider"
                >
                  <MenuItem value="openai">OpenAI</MenuItem>
                  <MenuItem value="anthropic">Anthropic</MenuItem>
                  <MenuItem value="local">Local Model</MenuItem>
                </Select>
              </FormControl>
              <TextField
                fullWidth
                label="Model Name"
                value={cfg.llm?.model_name || 'gpt-3.5-turbo'}
                onChange={e => onFieldChange('llm.model_name', e.target.value)}
                helperText="Specific model version to use"
              />
            </Stack>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField
                fullWidth
                label="API Endpoint"
                value={cfg.llm?.api_endpoint || ''}
                onChange={e => onFieldChange('llm.api_endpoint', e.target.value)}
                helperText="Custom API endpoint (for local models)"
              />
              <TextField
                fullWidth
                label="Temperature"
                type="number"
                slotProps={{ htmlInput: { step: "0.1", min: 0, max: 2 } }}
                value={cfg.llm?.temperature || 0.7}
                onChange={e => onFieldChange('llm.temperature', +e.target.value)}
                helperText="Model creativity (0.0 - 2.0)"
              />
            </Stack>
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* Export Settings */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography variant="h6">Export & Output Settings</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={3}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField
                fullWidth
                label="Output Directory"
                value={cfg.output?.directory || './output'}
                onChange={e => onFieldChange('output.directory', e.target.value)}
                helperText="Directory to save analysis results"
              />
              <FormControl fullWidth>
                <InputLabel>Default Export Format</InputLabel>
                <Select
                  value={cfg.output?.default_format || 'csv'}
                  onChange={e => onFieldChange('output.default_format', e.target.value)}
                  label="Default Export Format"
                >
                  <MenuItem value="csv">CSV</MenuItem>
                  <MenuItem value="json">JSON</MenuItem>
                  <MenuItem value="xlsx">Excel</MenuItem>
                </Select>
              </FormControl>
            </Stack>
            <FormControlLabel
              control={
                <Checkbox
                  checked={cfg.output?.include_raw_data !== false}
                  onChange={(_,v) => onFieldChange('output.include_raw_data', v)}
                />
              }
              label="Include raw review data in exports"
            />
          </Stack>
        </AccordionDetails>
      </Accordion>
    </Stack>
  )
}