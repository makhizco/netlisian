"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import getClassNameFactory from "../../lib/get-class-name-factory";
import styles from "./styles.module.css";

const getClassName = getClassNameFactory("ErrorBoundary", styles);

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error, resetError: () => void) => ReactNode);
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("Error caught by ErrorBoundary:", error, errorInfo);
  }

  resetError = (): void => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Render custom fallback UI if provided
      if (typeof this.props.fallback === "function") {
        return this.props.fallback(this.state.error!, this.resetError);
      }

      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className={getClassName()}>
          <h3 className={getClassName("title")}>
            Component Error
          </h3>
          <details className={getClassName("details")}>
            <summary>Show error details</summary>
            {this.state.error && this.state.error.toString()}
          </details>
          <button
            onClick={this.resetError}
            className={getClassName("button")}
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
