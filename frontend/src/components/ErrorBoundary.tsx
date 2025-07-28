// src/components/ErrorBoundary.tsx
import React from 'react'
import { RefreshCw, AlertCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <Card className="max-w-md w-full border-destructive/20">
            <CardContent className="p-6">
              <div className="flex flex-col items-center space-y-4 text-center">
                <div className="p-3 rounded-full bg-destructive/10 border border-destructive/20">
                  <AlertCircle className="h-8 w-8 text-destructive" />
                </div>
                <h2 className="text-xl font-semibold">Something went wrong</h2>
                <p className="text-muted-foreground">
                  The application encountered an unexpected error. Please try refreshing the page.
                </p>
                
                {this.state.error && (
                  <Alert className="w-full">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <pre className="text-xs font-mono whitespace-pre-wrap">
                        {this.state.error.message}
                      </pre>
                    </AlertDescription>
                  </Alert>
                )}

                <Button
                  onClick={() => window.location.reload()}
                  className="gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Refresh Page
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary