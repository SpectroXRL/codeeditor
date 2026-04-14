/**
 * Shared Page State Component
 * Handles loading/error/empty/content states in one wrapper
 */

import type { ReactNode } from "react";
import { LoadingSpinner } from "../LoadingSpinner";
import { ErrorMessage } from "../ErrorMessage";
import "./PageState.css";

export interface PageStateProps {
  /** Show loading state */
  isLoading?: boolean;
  /** Loading message */
  loadingMessage?: string;
  /** Error to display (shows error state if truthy) */
  error?: string | Error | null;
  /** Callback when retry button is clicked */
  onRetry?: () => void;
  /** Show empty state when true */
  isEmpty?: boolean;
  /** Message for empty state */
  emptyMessage?: string;
  /** Icon for empty state */
  emptyIcon?: string;
  /** Additional class name */
  className?: string;
  /** Content to render when not loading/error/empty */
  children: ReactNode;
}

export function PageState({
  isLoading = false,
  loadingMessage = "Loading...",
  error,
  onRetry,
  isEmpty = false,
  emptyMessage = "No content found",
  emptyIcon = "📭",
  className = "",
  children,
}: PageStateProps) {
  // Priority: loading > error > empty > content
  if (isLoading) {
    return (
      <div className={`page-state page-state--loading ${className}`.trim()}>
        <LoadingSpinner size="lg" message={loadingMessage} />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`page-state page-state--error ${className}`.trim()}>
        <ErrorMessage error={error} variant="box" onRetry={onRetry} />
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className={`page-state page-state--empty ${className}`.trim()}>
        <span className="page-state__icon">{emptyIcon}</span>
        <p className="page-state__message">{emptyMessage}</p>
      </div>
    );
  }

  return <>{children}</>;
}
