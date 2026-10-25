import { Component, type ErrorInfo, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'

interface ErrorBoundaryState {
  error: Error | null
}

export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled render error', error, info.componentStack)
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-4 p-6">
        <h1 className="text-lg font-semibold">The demo hit an unexpected error</h1>
        <p className="text-sm text-muted-foreground">
          Your model, API key, and parameters are saved. Reloading usually recovers.
        </p>
        <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs">{error.message}</pre>
        <Button size="lg" className="w-fit max-sm:h-11" onClick={() => window.location.reload()}>
          Reload the page
        </Button>
      </main>
    )
  }
}
