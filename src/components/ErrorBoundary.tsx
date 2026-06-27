import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { translations } from '../lib/i18n'
import { useStore } from '../store/useStore'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    this.setState({ errorInfo })
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  private handleReload = () => {
    window.location.reload()
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      const t = translations[useStore.getState().preferences.language || 'zh']

      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="max-w-md w-full p-6 bg-card rounded-lg border shadow-lg">
            <div className="flex items-center mb-4">
              <AlertCircle className="w-5 h-5 text-destructive mr-2" />
              <h1 className="text-sm font-semibold text-card-foreground">
                {t.errorTitle}
              </h1>
            </div>

            <div className="mb-4">
              <p className="text-sm text-muted-foreground mb-2">
                {t.errorDescription}
              </p>

              {this.state.error && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                    {t.technicalDetails}
                  </summary>
                  <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto border">
                    {this.state.error.toString()}
                    {this.state.errorInfo && (
                      <>
                        {'\n\n' + t.componentStack}
                        {this.state.errorInfo.componentStack}
                      </>
                    )}
                  </pre>
                </details>
              )}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={this.handleReset} className="flex-1">
                {t.tryAgain}
              </Button>
              <Button onClick={this.handleReload} className="flex-1">
                <RefreshCw className="w-3 h-3 mr-2" />
                {t.reloadApp}
              </Button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary fallback={fallback}>
      <Component {...props} />
    </ErrorBoundary>
  )

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`

  return WrappedComponent
}
