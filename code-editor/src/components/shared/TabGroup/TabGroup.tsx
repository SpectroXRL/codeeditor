/**
 * Shared Tab Group Component
 * Accessible tab navigation with keyboard support
 */

import { useRef, useEffect, type ReactNode, type KeyboardEvent } from "react";
import "./TabGroup.css";

export interface Tab {
  id: string;
  label: string;
  icon?: string | ReactNode;
  /** Badge count to show (e.g., unread count) */
  badge?: number;
  /** Disable this tab */
  disabled?: boolean;
}

export interface TabGroupProps {
  /** Array of tab definitions */
  tabs: Tab[];
  /** Currently active tab id */
  activeTab: string;
  /** Callback when tab changes */
  onTabChange: (tabId: string) => void;
  /** Visual variant */
  variant?: "default" | "pills" | "underline";
  /** Size preset */
  size?: "sm" | "md" | "lg";
  /** Full width tabs */
  fullWidth?: boolean;
  /** Additional class name */
  className?: string;
}

export function TabGroup({
  tabs,
  activeTab,
  onTabChange,
  variant = "default",
  size = "md",
  fullWidth = false,
  className = "",
}: TabGroupProps) {
  const tabListRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (
    e: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    const enabledTabs = tabs.filter((t) => !t.disabled);
    const currentEnabledIndex = enabledTabs.findIndex(
      (t) => t.id === tabs[index].id,
    );

    let nextIndex = -1;

    switch (e.key) {
      case "ArrowLeft":
      case "ArrowUp":
        e.preventDefault();
        nextIndex =
          currentEnabledIndex <= 0
            ? enabledTabs.length - 1
            : currentEnabledIndex - 1;
        break;
      case "ArrowRight":
      case "ArrowDown":
        e.preventDefault();
        nextIndex =
          currentEnabledIndex >= enabledTabs.length - 1
            ? 0
            : currentEnabledIndex + 1;
        break;
      case "Home":
        e.preventDefault();
        nextIndex = 0;
        break;
      case "End":
        e.preventDefault();
        nextIndex = enabledTabs.length - 1;
        break;
      default:
        return;
    }

    if (nextIndex >= 0) {
      const nextTab = enabledTabs[nextIndex];
      onTabChange(nextTab.id);
      // Focus the button
      const buttons = tabListRef.current?.querySelectorAll<HTMLButtonElement>(
        '[role="tab"]:not([disabled])',
      );
      buttons?.[nextIndex]?.focus();
    }
  };

  // Focus active tab on mount
  useEffect(() => {
    // Don't auto-focus on mount to avoid stealing focus
  }, []);

  return (
    <div
      ref={tabListRef}
      className={`tab-group tab-group--${variant} tab-group--${size} ${fullWidth ? "tab-group--full" : ""} ${className}`.trim()}
      role="tablist"
      aria-orientation="horizontal"
    >
      {tabs.map((tab, index) => (
        <button
          key={tab.id}
          role="tab"
          type="button"
          id={`tab-${tab.id}`}
          aria-selected={activeTab === tab.id}
          aria-controls={`tabpanel-${tab.id}`}
          tabIndex={activeTab === tab.id ? 0 : -1}
          disabled={tab.disabled}
          className={`tab-group__tab ${activeTab === tab.id ? "tab-group__tab--active" : ""}`}
          onClick={() => !tab.disabled && onTabChange(tab.id)}
          onKeyDown={(e) => handleKeyDown(e, index)}
        >
          {tab.icon && (
            <span className="tab-group__icon">
              {typeof tab.icon === "string" ? tab.icon : tab.icon}
            </span>
          )}
          <span className="tab-group__label">{tab.label}</span>
          {tab.badge !== undefined && tab.badge > 0 && (
            <span className="tab-group__badge">
              {tab.badge > 99 ? "99+" : tab.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
