// src/pages/HelpPage.tsx
import {
  HelpCircle, Play, Search, Edit, BarChart3,
  Settings, FolderOpen, AlertCircle, ChevronDown
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

export default function HelpPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-3">
          <div className="p-3 rounded-full bg-primary/10 border border-primary/20">
            <HelpCircle className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Help & Documentation
          </h1>
        </div>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Complete guide to using the Steam Review Analyzer.
        </p>
      </div>

      {/* Quick Start Guide */}
      <Card className="border-2 border-primary/20 bg-card/50 backdrop-blur-sm">
        <CardHeader>
          <CardTitle className="text-xl">Quick Start Guide</CardTitle>
          <CardDescription>
            Get started with the Steam Review Analyzer in 4 simple steps:
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 rounded-lg bg-secondary/20">
              <div className="p-2 rounded-full bg-primary/10">
                <Search className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">1. Find Games</h3>
                <p className="text-sm text-muted-foreground">
                  Use the App Finder to search and select Steam games for analysis
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-secondary/20">
              <div className="p-2 rounded-full bg-primary/10">
                <Settings className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">2. Configure Settings</h3>
                <p className="text-sm text-muted-foreground">
                  Adjust fetching parameters, analysis options, and LLM configuration
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-secondary/20">
              <div className="p-2 rounded-full bg-primary/10">
                <Edit className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">3. Customize Prompt</h3>
                <p className="text-sm text-muted-foreground">
                  Edit the AI prompt to guide the analysis according to your needs
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 rounded-lg bg-secondary/20">
              <div className="p-2 rounded-full bg-primary/10">
                <Play className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">4. Run Analysis</h3>
                <p className="text-sm text-muted-foreground">
                  Start the scraping and analysis process from the Dashboard
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Feature Overview */}
      <Accordion type="single" collapsible className="border border-border/50 rounded-lg">
        <AccordionItem value="features">
          <AccordionTrigger className="px-6 py-4 text-lg font-semibold">
            Feature Overview
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-4">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <BarChart3 className="h-5 w-5 text-primary mt-1" />
                <div>
                  <h4 className="font-semibold">Dashboard</h4>
                  <p className="text-sm text-muted-foreground">
                    Central control panel for starting/stopping processes, monitoring real-time progress, 
                    and viewing activity logs with detailed status updates.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Search className="h-5 w-5 text-primary mt-1" />
                <div>
                  <h4 className="font-semibold">App Finder</h4>
                  <p className="text-sm text-muted-foreground">
                    Search Steam's database by game name, App ID, or Steam URL. Add multiple games 
                    to your analysis queue with bulk selection features.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Edit className="h-5 w-5 text-primary mt-1" />
                <div>
                  <h4 className="font-semibold">Prompt Editor</h4>
                  <p className="text-sm text-muted-foreground">
                    Monaco-powered editor for customizing the AI analysis prompt. Write detailed 
                    instructions for sentiment analysis, topic extraction, and review summarization.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <BarChart3 className="h-5 w-5 text-primary mt-1" />
                <div>
                  <h4 className="font-semibold">Results Viewer</h4>
                  <p className="text-sm text-muted-foreground">
                    Browse analyzed reviews with advanced filtering, sorting, and export capabilities. 
                    View detailed AI insights including sentiment, topics, and summaries.
                  </p>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Configuration Guide */}
      <Accordion type="single" collapsible className="border border-border/50 rounded-lg">
        <AccordionItem value="configuration">
          <AccordionTrigger className="px-6 py-4 text-lg font-semibold">
            Configuration Guide
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-4">
            <div className="space-y-6">
              <div>
                <h4 className="font-semibold mb-3">Data Fetching Settings:</h4>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                    <div>
                      <p className="font-medium">Reviews per App</p>
                      <p className="text-sm text-muted-foreground">Maximum number of reviews to fetch per game (default: 100)</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                    <div>
                      <p className="font-medium">Complete Scraping</p>
                      <p className="text-sm text-muted-foreground">Enable to fetch all available reviews, ignoring the per-app limit</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                    <div>
                      <p className="font-medium">Language Filtering</p>
                      <p className="text-sm text-muted-foreground">Filter reviews by language to focus on specific regions</p>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-3">AI Analysis Settings:</h4>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                    <div>
                      <p className="font-medium">Reviews to Analyze</p>
                      <p className="text-sm text-muted-foreground">Number of reviews to process with AI (subset of fetched reviews)</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                    <div>
                      <p className="font-medium">Skip Scraping</p>
                      <p className="text-sm text-muted-foreground">Use existing cached data instead of fetching new reviews</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                    <div>
                      <p className="font-medium">LLM Provider</p>
                      <p className="text-sm text-muted-foreground">Choose between OpenAI, Anthropic, or local models</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* File Structure */}
      <Accordion type="single" collapsible className="border border-border/50 rounded-lg">
        <AccordionItem value="files">
          <AccordionTrigger className="px-6 py-4 text-lg font-semibold">
            Output Files & Structure
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-4">
            <div className="space-y-4">
              <div className="bg-secondary/20 p-4 rounded-lg font-mono text-sm">
                <pre>{`output/
├── raw/
│   └── GameName_AppID_raw_reviews.csv
├── analyzed/
│   └── GameName_AppID_ModelName_analyzed.csv
└── summary/
    └── GameName_AppID_summary.json`}</pre>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <FolderOpen className="h-5 w-5 text-primary mt-1" />
                  <div>
                    <p className="font-medium">raw/</p>
                    <p className="text-sm text-muted-foreground">Original review data fetched from Steam API</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <FolderOpen className="h-5 w-5 text-primary mt-1" />
                  <div>
                    <p className="font-medium">analyzed/</p>
                    <p className="text-sm text-muted-foreground">Reviews with AI analysis (sentiment, topics, summaries)</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <FolderOpen className="h-5 w-5 text-primary mt-1" />
                  <div>
                    <p className="font-medium">summary/</p>
                    <p className="text-sm text-muted-foreground">Aggregate statistics and insights</p>
                  </div>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Troubleshooting */}
      <Accordion type="single" collapsible className="border border-border/50 rounded-lg">
        <AccordionItem value="troubleshooting">
          <AccordionTrigger className="px-6 py-4 text-lg font-semibold">
            Troubleshooting
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-4">
            <div className="space-y-6">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <AlertCircle className="h-5 w-5 text-destructive" />
                  <h4 className="font-semibold">Common Issues</h4>
                </div>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-destructive mt-2 flex-shrink-0" />
                    <div>
                      <p className="font-medium">API Rate Limiting</p>
                      <p className="text-sm text-muted-foreground">Reduce 'Max Requests per App' or enable delays between requests</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-destructive mt-2 flex-shrink-0" />
                    <div>
                      <p className="font-medium">LLM Connection Errors</p>
                      <p className="text-sm text-muted-foreground">Check API keys, endpoint URLs, and network connectivity</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-destructive mt-2 flex-shrink-0" />
                    <div>
                      <p className="font-medium">No Reviews Found</p>
                      <p className="text-sm text-muted-foreground">Game may have few reviews or language filters may be too restrictive</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-destructive mt-2 flex-shrink-0" />
                    <div>
                      <p className="font-medium">Process Stuck</p>
                      <p className="text-sm text-muted-foreground">Use the Stop button and check activity logs for error details</p>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-3">Performance Tips</h4>
                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>• Start with smaller datasets (50-100 reviews) for testing</p>
                  <p>• Use 'Skip Scraping' to re-analyze existing data</p>
                  <p>• Monitor the activity log for progress and errors</p>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* About */}
      <Card className="border border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            About Steam Review Analyzer
          </CardTitle>
          <div className="flex gap-2 mt-2">
            <Badge variant="default">Version 2.0</Badge>
            <Badge variant="outline">React + TypeScript</Badge>
            <Badge variant="outline">shadcn/ui</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            A modern web application for scraping and analyzing Steam game reviews using 
            large language models. Built with React, TypeScript, and shadcn/ui for the 
            frontend, with a Python FastAPI backend for data processing and AI integration.
          </p>
          <Separator className="my-4" />
          <p className="text-sm text-muted-foreground">
            This tool helps game developers, researchers, and analysts understand player 
            sentiment and feedback through automated review analysis.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}