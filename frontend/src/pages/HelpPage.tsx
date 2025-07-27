// src/pages/HelpPage.tsx
import { 
  Typography, Stack, Card, CardContent, Accordion,
  AccordionSummary, AccordionDetails, List, ListItem,
  ListItemText, ListItemIcon, Chip, Box, Divider,
  Paper
} from '@mui/material'
import { 
  ExpandMore, PlayArrow, Search, Edit, Analytics,
  Settings, FolderOpen, Error
} from '@mui/icons-material'

export default function HelpPage() {
  return (
    <Stack spacing={3}>
      <Typography variant="h4">Help & Documentation</Typography>

      {/* Quick Start Guide */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>Quick Start Guide</Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Get started with the Steam Review Analyzer in 4 simple steps:
          </Typography>
          <List>
            <ListItem>
              <ListItemIcon><Search color="primary" /></ListItemIcon>
              <ListItemText 
                primary="1. Find Games" 
                secondary="Use the App Finder to search and select Steam games for analysis"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon><Settings color="primary" /></ListItemIcon>
              <ListItemText 
                primary="2. Configure Settings" 
                secondary="Adjust fetching parameters, analysis options, and LLM configuration"
              />
            </ListItem>
            <ListItem>
              <ListItemIcon><Edit color="primary" /></ListItemIcon>
              <ListItemText 
                primary="3. Customize Prompt" 
                secondary="Edit the AI prompt to guide the analysis according to your needs" 
              />
            </ListItem>
            <ListItem>
              <ListItemIcon><PlayArrow color="primary" /></ListItemIcon>
              <ListItemText 
                primary="4. Run Analysis" 
                secondary="Start the scraping and analysis process from the Dashboard"
              />
            </ListItem>
          </List>
        </CardContent>
      </Card>

      {/* Feature Overview */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography variant="h6">Feature Overview</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                <Analytics sx={{ mr: 1, verticalAlign: 'middle' }} />
                Dashboard
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Central control panel for starting/stopping processes, monitoring real-time progress, 
                and viewing activity logs with detailed status updates.
              </Typography>
            </Box>

            <Box>
              <Typography variant="subtitle1" gutterBottom>
                <Search sx={{ mr: 1, verticalAlign: 'middle' }} />
                App Finder
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Search Steam's database by game name, App ID, or Steam URL. Add multiple games 
                to your analysis queue with bulk selection features.
              </Typography>
            </Box>

            <Box>
              <Typography variant="subtitle1" gutterBottom>
                <Edit sx={{ mr: 1, verticalAlign: 'middle' }} />
                Prompt Editor
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Monaco-powered editor for customizing the AI analysis prompt. Write detailed 
                instructions for sentiment analysis, topic extraction, and review summarization.
              </Typography>
            </Box>

            <Box>
              <Typography variant="subtitle1" gutterBottom>
                <Analytics sx={{ mr: 1, verticalAlign: 'middle' }} />
                Results Viewer
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Browse analyzed reviews with advanced filtering, sorting, and export capabilities. 
                View detailed AI insights including sentiment, topics, and summaries.
              </Typography>
            </Box>
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* Configuration Guide */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography variant="h6">Configuration Guide</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            <Typography variant="subtitle2">Data Fetching Settings:</Typography>
            <List dense>
              <ListItem>
                <ListItemText 
                  primary="Reviews per App" 
                  secondary="Maximum number of reviews to fetch per game (default: 100)"
                />
              </ListItem>
              <ListItem>
                <ListItemText 
                  primary="Complete Scraping" 
                  secondary="Enable to fetch all available reviews, ignoring the per-app limit"
                />
              </ListItem>
              <ListItem>
                <ListItemText 
                  primary="Language Filtering" 
                  secondary="Filter reviews by language to focus on specific regions"
                />
              </ListItem>
            </List>

            <Typography variant="subtitle2">AI Analysis Settings:</Typography>
            <List dense>
              <ListItem>
                <ListItemText 
                  primary="Reviews to Analyze" 
                  secondary="Number of reviews to process with AI (subset of fetched reviews)"
                />
              </ListItem>
              <ListItem>
                <ListItemText 
                  primary="Skip Scraping" 
                  secondary="Use existing cached data instead of fetching new reviews"
                />
              </ListItem>
              <ListItem>
                <ListItemText 
                  primary="LLM Provider" 
                  secondary="Choose between OpenAI, Anthropic, or local models"
                />
              </ListItem>
            </List>
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* File Structure */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography variant="h6">Output Files & Structure</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            <Paper sx={{ p: 2, bgcolor: 'grey.50' }}>
              <Typography variant="body2" component="pre" sx={{ fontFamily: 'monospace' }}>
{`output/
├── raw/
│   └── GameName_AppID_raw_reviews.csv
├── analyzed/
│   └── GameName_AppID_ModelName_analyzed.csv
└── summary/
    └── GameName_AppID_summary.json`}
              </Typography>
            </Paper>
            
            <List dense>
              <ListItem>
                <ListItemIcon><FolderOpen /></ListItemIcon>
                <ListItemText 
                  primary="raw/" 
                  secondary="Original review data fetched from Steam API"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon><FolderOpen /></ListItemIcon>
                <ListItemText 
                  primary="analyzed/" 
                  secondary="Reviews with AI analysis (sentiment, topics, summaries)"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon><FolderOpen /></ListItemIcon>
                <ListItemText 
                  primary="summary/" 
                  secondary="Aggregate statistics and insights"
                />
              </ListItem>
            </List>
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* Troubleshooting */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography variant="h6">Troubleshooting</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                <Error color="error" sx={{ mr: 1, verticalAlign: 'middle' }} />
                Common Issues
              </Typography>
              
              <List dense>
                <ListItem>
                  <ListItemText 
                    primary="API Rate Limiting" 
                    secondary="Reduce 'Max Requests per App' or enable delays between requests"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText 
                    primary="LLM Connection Errors" 
                    secondary="Check API keys, endpoint URLs, and network connectivity"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText 
                    primary="No Reviews Found" 
                    secondary="Game may have few reviews or language filters may be too restrictive"
                  />
                </ListItem>
                <ListItem>
                  <ListItemText 
                    primary="Process Stuck" 
                    secondary="Use the Stop button and check activity logs for error details"
                  />
                </ListItem>
              </List>
            </Box>

            <Box>
              <Typography variant="subtitle2" gutterBottom>Performance Tips</Typography>
              <List dense>
                <ListItem>
                  <ListItemText 
                    primary="• Start with smaller datasets (50-100 reviews) for testing"
                    secondary=""
                  />
                </ListItem>
                <ListItem>
                  <ListItemText 
                    primary="• Use 'Skip Scraping' to re-analyze existing data"
                    secondary=""
                  />
                </ListItem>
                <ListItem>
                  <ListItemText 
                    primary="• Monitor the activity log for progress and errors"
                    secondary=""
                  />
                </ListItem>
              </List>
            </Box>
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* About */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>About Steam Review Analyzer</Typography>
          <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
            <Chip label="Version 2.0" color="primary" size="small" />
            <Chip label="React + TypeScript" variant="outlined" size="small" />
            <Chip label="Material UI" variant="outlined" size="small" />
          </Stack>
          <Typography variant="body2" color="text.secondary">
            A modern web application for scraping and analyzing Steam game reviews using 
            large language models. Built with React, TypeScript, and Material UI for the 
            frontend, with a Python FastAPI backend for data processing and AI integration.
          </Typography>
          <Divider sx={{ my: 2 }} />
          <Typography variant="caption" color="text.secondary">
            This tool helps game developers, researchers, and analysts understand player 
            sentiment and feedback through automated review analysis.
          </Typography>
        </CardContent>
      </Card>
    </Stack>
  )
}