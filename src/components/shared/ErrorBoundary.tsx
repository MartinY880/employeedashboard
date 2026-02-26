// ProConnect — Error Boundary
// Catches runtime errors in widget subtrees and shows a recoverable fallback

"use client";

import { Component, type ReactNode, type ErrorInfo } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Compact mode for small widgets (e.g. sidebar panels) */
  compact?: boolean;
  /** Widget name shown in the fallback message */
  label?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ProConnect ErrorBoundary${this.props.label ? ` — ${this.props.label}` : ""}]`, error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const { compact, label } = this.props;

      if (compact) {
        return (
          <div className="flex flex-col items-center justify-center py-6 px-4 text-center">
            <AlertTriangle className="w-6 h-6 text-amber-500 mb-2" />
            <p className="text-xs text-brand-grey mb-2">
              {label ? `${label} failed to load` : "Something went wrong"}
            </p>
            <Button
              size="sm"
              variant="ghost"
              onClick={this.handleRetry}
              className="text-xs text-brand-blue"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Retry
            </Button>
          </div>
        );
      }

      return (
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 mb-4">
            <AlertTriangle className="w-6 h-6 text-amber-500" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
            {label ? `${label} encountered an error` : "Something went wrong"}
          </h3>
          <p className="text-xs text-brand-grey mb-4 max-w-xs">
            An unexpected error occurred. You can try again or refresh the page.
          </p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={this.handleRetry}
              className="text-xs"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Try Again
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => window.location.reload()}
              className="text-xs text-brand-grey"
            >
              Refresh Page
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
