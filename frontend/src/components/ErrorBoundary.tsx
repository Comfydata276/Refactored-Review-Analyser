// src/components/ErrorBoundary.tsx
import React from 'react'
import { Card, CardContent, Typography, Button, Stack, Alert } from '@mui/material'
import { Refresh, Error } from '@mui/icons-material'

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
        <Card sx={{ m: 2, maxWidth: 600, mx: 'auto' }}>
          <CardContent>
            <Stack spacing={2} alignItems="center">
              <Error color="error" sx={{ fontSize: 48 }} />
              <Typography variant="h5">Something went wrong</Typography>
              <Typography variant="body2" color="text.secondary" textAlign="center">
                The application encountered an unexpected error. Please try refreshing the page.
              </Typography>
              
              {this.state.error && (
                <Alert severity="error" sx={{ width: '100%', mt: 2 }}>
                  <Typography variant="caption" component="pre">
                    {this.state.error.message}
                  </Typography>
                </Alert>
              )}

              <Button
                variant="contained"
                startIcon={<Refresh />}
                onClick={() => window.location.reload()}
              >
                Refresh Page
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary