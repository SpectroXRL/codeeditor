/**
 * Shared Loading Spinner Component
 * Variants: spinner (circular), dots (animated), skeleton (shimmer)
 */

import "./LoadingSpinner.css";

export type LoadingVariant = "spinner" | "dots" | "skeleton";
export type LoadingSize = "sm" | "md" | "lg";

export interface LoadingSpinnerProps {
  /** Visual style of the loading indicator */
  variant?: LoadingVariant;
  /** Size preset */
  size?: LoadingSize;
  /** Optional message to display below the spinner */
  message?: string;
  /** Additional class name */
  className?: string;
}

const sizeMap = {
  sm: 16,
  md: 24,
  lg: 40,
};

export function LoadingSpinner({
  variant = "spinner",
  size = "md",
  message,
  className = "",
}: LoadingSpinnerProps) {
  const sizeValue = sizeMap[size];

  return (
    <div
      className={`loading-spinner loading-spinner--${size} ${className}`.trim()}
    >
      {variant === "spinner" && (
        <div
          className="loading-spinner__circle"
          style={{ width: sizeValue, height: sizeValue }}
          role="status"
          aria-label={message || "Loading"}
        />
      )}

      {variant === "dots" && (
        <div
          className="loading-spinner__dots"
          role="status"
          aria-label={message || "Loading"}
        >
          <span className="loading-spinner__dot" />
          <span className="loading-spinner__dot" />
          <span className="loading-spinner__dot" />
        </div>
      )}

      {variant === "skeleton" && (
        <div
          className="loading-spinner__skeleton"
          style={{ height: sizeValue }}
          role="status"
          aria-label={message || "Loading"}
        />
      )}

      {message && <span className="loading-spinner__message">{message}</span>}
    </div>
  );
}
