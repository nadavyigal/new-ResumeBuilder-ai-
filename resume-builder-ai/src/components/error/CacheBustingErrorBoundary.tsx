'use client';

import { Component, ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw, Trash2 } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  is406Error: boolean;
}

/**
 * Error Boundary that detects 406 errors and provides cache clearing instructions
 *
 * 406 errors occur when Supabase receives malformed queries from cached JavaScript.
 * This boundary helps users clear their cache to fetch the latest code.
 */
export class CacheBustingErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, is406Error: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // Check if this is a 406 error
    const is406 = error.message.includes('406') ||
                  error.message.includes('Cannot coerce') ||
                  error.message.includes('single JSON object');

    return {
      hasError: true,
      error,
      is406Error: is406,
    };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Error boundary caught error:', error, errorInfo);
  }

  handleHardRefresh = () => {
    // Force hard refresh by clearing cache and reloading
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  handleClearCache = async () => {
    try {
      // Clear browser cache using Cache API
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(name => caches.delete(name))
        );
      }

      // Clear localStorage
      localStorage.clear();

      // Clear sessionStorage
      sessionStorage.clear();

      // Reload page
      window.location.reload();
    } catch (err) {
      console.error('Failed to clear cache:', err);
      // Fallback to hard refresh
      this.handleHardRefresh();
    }
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.state.is406Error) {
      return (
        <div className="min-h-screen bg-muted/50 p-4 md:p-10 flex items-center justify-center">
          <Card className="max-w-2xl w-full border-destructive">
            <CardHeader>
              <div className="flex items-center gap-3">
                <AlertCircle className="h-8 w-8 text-destructive" />
                <CardTitle className="text-2xl text-destructive">
                  Cached Code Detected
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <p className="text-base">
                  Your browser is using an outdated version of the application. This can happen after updates are deployed.
                </p>
                <div className="bg-muted p-4 rounded-lg border">
                  <p className="text-sm font-mono text-destructive">
                    Error: {this.state.error?.message || 'Cannot coerce the result to a single JSON object (406)'}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold text-lg">Quick Fix:</h3>

                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold flex-shrink-0">
                      1
                    </div>
                    <div className="flex-1">
                      <p className="font-medium mb-2">Try a Hard Refresh (Fastest)</p>
                      <Button
                        onClick={this.handleHardRefresh}
                        className="w-full sm:w-auto"
                        size="lg"
                      >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Hard Refresh (Ctrl+Shift+R)
                      </Button>
                      <p className="text-sm text-muted-foreground mt-2">
                        Windows: Ctrl+Shift+R | Mac: Cmd+Shift+R
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold flex-shrink-0">
                      2
                    </div>
                    <div className="flex-1">
                      <p className="font-medium mb-2">If that doesn't work, Clear All Cache</p>
                      <Button
                        onClick={this.handleClearCache}
                        variant="destructive"
                        className="w-full sm:w-auto"
                        size="lg"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Clear Cache & Reload
                      </Button>
                      <p className="text-sm text-muted-foreground mt-2">
                        This will clear all browser cache and reload the page with fresh code.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mt-4">
                  <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                    Still having issues?
                  </p>
                  <ul className="text-sm text-amber-800 dark:text-amber-200 mt-2 space-y-1 list-disc list-inside">
                    <li>Open this page in an incognito/private window</li>
                    <li>Try a different browser</li>
                    <li>Clear browser data in Settings (choose "Cached images and files")</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    // Generic error fallback
    return (
      <div className="min-h-screen bg-muted/50 p-4 md:p-10 flex items-center justify-center">
        <Card className="max-w-2xl w-full border-destructive">
          <CardHeader>
            <div className="flex items-center gap-3">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <CardTitle className="text-2xl">Something went wrong</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-base">
              An unexpected error occurred. Please try refreshing the page.
            </p>
            <div className="bg-muted p-4 rounded-lg border">
              <p className="text-sm font-mono text-destructive">
                {this.state.error?.message || 'Unknown error'}
              </p>
            </div>
            <div className="flex gap-3">
              <Button onClick={this.handleHardRefresh} size="lg">
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh Page
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
}
