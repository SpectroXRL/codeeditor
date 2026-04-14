/**
 * Tabbed Sidebar Component
 * Combines Chat and Hints panels in a single tabbed drawer
 */

import { useEffect, useCallback } from "react";
import { TabGroup, type Tab } from "../shared";
import { ChatDrawer } from "./ChatDrawer";
import type { TestResult } from "./TestCasesPanel";
import "./TabbedSidebar.css";

export type SidebarTab = "chat" | "hints";

interface TabbedSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;

  // Chat props
  code: string;
  lessonInfo: string;
  lessonTitle: string;
  testResults: TestResult[];
  isAuthenticated: boolean;
  canCall: boolean;
  callsUsed: number;
  maxCalls: number;
  resetTime: Date | null;
  onMessageSent: () => void;

  // Hints props
  hints: string[];
  hintsRevealed: number;
  onRevealNextHint: () => void;
}

export function TabbedSidebar({
  isOpen,
  onClose,
  activeTab,
  onTabChange,
  // Chat props
  code,
  lessonInfo,
  lessonTitle,
  testResults,
  isAuthenticated,
  canCall,
  callsUsed,
  maxCalls,
  resetTime,
  onMessageSent,
  // Hints props
  hints,
  hintsRevealed,
  onRevealNextHint,
}: TabbedSidebarProps) {
  // Calculate badges
  const availableHints = hints.length - hintsRevealed;

  const tabs: Tab[] = [
    {
      id: "chat",
      label: "Chat",
      icon: "💬",
    },
    {
      id: "hints",
      label: "Hints",
      icon: "💡",
      badge: availableHints > 0 ? availableHints : undefined,
    },
  ];

  const handleTabChange = useCallback(
    (tabId: string) => {
      onTabChange(tabId as SidebarTab);
    },
    [onTabChange],
  );

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const hasHints = hints && hints.length > 0;
  const hasMoreHints = hintsRevealed < hints.length;
  const visibleHints = hints.slice(0, hintsRevealed);

  return (
    <div className="tabbed-sidebar">
      <div className="tabbed-sidebar__header">
        <TabGroup
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          size="sm"
          fullWidth
        />
        <button
          className="tabbed-sidebar__close"
          onClick={onClose}
          aria-label="Close sidebar"
        >
          ✕
        </button>
      </div>

      <div className="tabbed-sidebar__content">
        {activeTab === "chat" && (
          <div
            className="tabbed-sidebar__panel"
            id="tabpanel-chat"
            role="tabpanel"
            aria-labelledby="tab-chat"
          >
            <ChatDrawer
              isOpen={true}
              onClose={onClose}
              code={code}
              lessonInfo={lessonInfo}
              lessonTitle={lessonTitle}
              testResults={testResults}
              isAuthenticated={isAuthenticated}
              canCall={canCall}
              callsUsed={callsUsed}
              maxCalls={maxCalls}
              resetTime={resetTime}
              onMessageSent={onMessageSent}
            />
          </div>
        )}

        {activeTab === "hints" && (
          <div
            className="tabbed-sidebar__panel tabbed-sidebar__panel--hints"
            id="tabpanel-hints"
            role="tabpanel"
            aria-labelledby="tab-hints"
          >
            {!isAuthenticated ? (
              <div className="hints-auth-prompt">
                <span className="hints-auth-prompt__icon">🔒</span>
                <p>Sign in to access hints for this lesson</p>
              </div>
            ) : !hasHints ? (
              <div className="hints-empty-state">
                <span className="hints-empty-state__icon">🎯</span>
                <p>No hints available for this lesson</p>
              </div>
            ) : hintsRevealed === 0 ? (
              <div className="hints-start">
                <span className="hints-start__icon">💡</span>
                <p>Need a nudge in the right direction?</p>
                <button className="hints-reveal-btn" onClick={onRevealNextHint}>
                  Show first hint
                </button>
              </div>
            ) : (
              <div className="hints-content">
                <div className="hints-list">
                  {visibleHints.map((hint, idx) => (
                    <div key={idx} className="hint-item">
                      <span className="hint-item__number">{idx + 1}</span>
                      <span className="hint-item__text">{hint}</span>
                    </div>
                  ))}
                </div>

                {hasMoreHints && (
                  <button
                    className="hints-reveal-btn"
                    onClick={onRevealNextHint}
                  >
                    Show hint {hintsRevealed + 1} of {hints.length}
                  </button>
                )}

                <div className="hints-progress">
                  {hintsRevealed} of {hints.length} hints revealed
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
