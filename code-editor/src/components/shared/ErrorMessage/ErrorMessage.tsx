/**
 * Shared Error Message Component
 * Variants: inline (forms), banner (pages), box (panels)
 */

import "./ErrorMessage.css";

export type ErrorVariant = "inline" | "banner" | "box";

export interface ErrorMessageProps {
  /** The error message to display */
  error: string | Error | null | undefined;
  /** Visual style variant */
  variant?: ErrorVariant;
  /** Callback when retry button is clicked */
  onRetry?: () => void;
  /** Callback when dismiss button is clicked */
  onDismiss?: () => void;
  /** Custom retry button text */
  retryText?: string;
  /** Additional class name */
  className?: string;
}

export function ErrorMessage({
  error,
  variant = "inline",
  onRetry,
  onDismiss,
  retryText = "Try again",
  className = "",
}: ErrorMessageProps) {
  if (!error) return null;

  const message = error instanceof Error ? error.message : error;

  return (
    <div
      className={`error-message error-message--${variant} ${className}`.trim()}
      role="alert"
    >
      <div className="error-message__content">
        <span className="error-message__icon">⚠</span>
        <span className="error-message__text">{message}</span>
      </div>

      {(onRetry || onDismiss) && (
        <div className="error-message__actions">
          {onRetry && (
            <button
              type="button"
              className="error-message__btn error-message__btn--retry"
              onClick={onRetry}
            >
              {retryText}
            </button>
          )}
          {onDismiss && (
            <button
              type="button"
              className="error-message__btn error-message__btn--dismiss"
              onClick={onDismiss}
              aria-label="Dismiss error"
            >
              ✕
            </button>
          )}
        </div>
      )}
    </div>
  );
}
