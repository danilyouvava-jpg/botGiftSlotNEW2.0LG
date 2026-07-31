import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-4 bg-red-900/50 rounded-xl border border-red-500/50 text-center">
            <h3 className="font-bold text-red-200">Something went wrong</h3>
            <p className="text-sm text-red-300 mt-1">{this.state.error?.message}</p>
            <button 
                onClick={() => this.setState({ hasError: false })}
                className="mt-3 px-4 py-1 bg-red-600 rounded-full text-xs font-bold"
            >
                Try Again
            </button>
        </div>
      );
    }

    return this.props.children;
  }
}
