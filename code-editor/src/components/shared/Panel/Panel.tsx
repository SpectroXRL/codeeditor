/**
 * Shared Panel Component
 * A composable container with header, content, loading/empty states, and optional collapsibility
 */

import { useState, type ReactNode } from "react";
import "./Panel.css";

export interface PanelHeaderConfig {
  title: string;
  icon?: string | ReactNode;
  /** Content shown on the right side of header (badges, counts, buttons) */
  action?: ReactNode;
  /** Use gradient style (e.g., for hints panel) */
  variant?: "default" | "gradient-amber";
}

export interface PanelProps {
  /** Header configuration - omit for headerless panel */
  header?: PanelHeaderConfig;
  /** Show loading spinner and message */
  isLoading?: boolean;
  loadingMessage?: string;
  /** Show empty state message */
  isEmpty?: boolean;
  emptyMessage?: string;
  /** Make header clickable to expand/collapse content */
  collapsible?: boolean;
  defaultExpanded?: boolean;
  /** Constrain content height with scroll */
  maxHeight?: string;
  /** Additional class name for the container */
  className?: string;
  /** Panel content */
  children: ReactNode;
}

export function Panel({
  header,
  isLoading = false,
  loadingMessage = "Loading...",
  isEmpty = false,
  emptyMessage = "No content available",
  collapsible = false,
  defaultExpanded = true,
  maxHeight,
  className = "",
  children,
}: PanelProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const handleHeaderClick = () => {
    if (collapsible) {
      setIsExpanded(!isExpanded);
    }
  };

  const headerVariant = header?.variant ?? "default";
  const showContent = !collapsible || isExpanded;

  return (
    <div className={`panel ${className}`.trim()}>
      {header && (
        <div
          className={`panel-header panel-header--${headerVariant} ${collapsible ? "panel-header--collapsible" : ""}`}
          onClick={collapsible ? handleHeaderClick : undefined}
          role={collapsible ? "button" : undefined}
          aria-expanded={collapsible ? isExpanded : undefined}
          tabIndex={collapsible ? 0 : undefined}
          onKeyDown={
            collapsible
              ? (e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleHeaderClick();
                  }
                }
              : undefined
          }
        >
          <div className="panel-header__left">
            {header.icon && (
              <span className="panel-header__icon">
                {typeof header.icon === "string" ? header.icon : header.icon}
              </span>
            )}
            <span className="panel-header__title">{header.title}</span>
          </div>
          <div className="panel-header__right">
            {header.action}
            {collapsible && (
              <span
                className={`panel-header__expand ${isExpanded ? "expanded" : ""}`}
              >
                ▼
              </span>
            )}
          </div>
        </div>
      )}

      {showContent && (
        <div
          className="panel-content"
          style={maxHeight ? { maxHeight, overflowY: "auto" } : undefined}
        >
          {isLoading ? (
            <div className="panel-loading">
              <div className="panel-spinner" />
              <span>{loadingMessage}</span>
            </div>
          ) : isEmpty ? (
            <div className="panel-empty">
              <p>{emptyMessage}</p>
            </div>
          ) : (
            children
          )}
        </div>
      )}
    </div>
  );
}
