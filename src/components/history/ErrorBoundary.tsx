'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from '@/lib/icons';

/**
 * ErrorBoundary Component
 * Feature: 005-history-view-previous (Phase 7 - T043)
 *
 * Catches and handles React errors in the history view.
 * Displays user-friendly error message with retry functionality.
 * Logs errors to console for debugging (can be extended to monitoring service).
 */

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackMessage?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export default class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error details to console
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // TODO: Send to monitoring service (e.g., Sentry, LogRocket)
    // logErrorToService(error, errorInfo);

    // Update state with error info
    this.setState({
      error,
      errorInfo,
    });
  }

  handleRetry = () => {
    // Reset error state and attempt to re-render
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });

    // Optionally reload the page for a full reset
    // window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[400px] flex-col items-center justify-center p-8">
          <div className="w-full max-w-md space-y-6 text-center">
            {/* Error Icon */}
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-10 w-10 text-destructive" />
            </div>

            {/* Error Title */}
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold tracking-tight">
                Something went wrong
              </h2>
              <p className="text-sm text-muted-foreground">
                {this.props.fallbackMessage ||
                  "We're sorry, but something unexpected happened while loading your optimization history."}
              </p>
            </div>

            {/* Error Details (Development Only) */}
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="rounded-md bg-muted p-4 text-left">
                <p className="text-xs font-mono text-destructive">
                  {this.state.error.toString()}
                </p>
                {this.state.errorInfo && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                      Component Stack
                    </summary>
                    <pre className="mt-2 text-xs text-muted-foreground overflow-auto">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </details>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Button
                onClick={this.handleRetry}
                variant="default"
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Try Again
              </Button>
              <Button
                onClick={() => (window.location.href = '/dashboard')}
                variant="outline"
              >
                Back to Dashboard
              </Button>
            </div>

            {/* Help Text */}
            <p className="text-xs text-muted-foreground">
              If this problem persists, please{' '}
              <a
                href="/support"
                className="underline underline-offset-2 hover:text-foreground"
              >
                contact support
              </a>
              .
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
