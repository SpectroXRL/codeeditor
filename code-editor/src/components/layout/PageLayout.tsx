import type { ReactNode } from "react";
import { Header } from "./Header";

interface PageLayoutProps {
  children: ReactNode;
}

export function PageLayout({ children }: PageLayoutProps) {
  const layoutStyle = {
    display: "flex",
    flexDirection: "column" as const,
    height: "100vh",
    backgroundColor: "var(--bg-primary)",
    overflow: "hidden" as const,
  };

  const contentStyle = {
    flex: 1,
    display: "flex",
    flexDirection: "column" as const,
    minHeight: 0,
    overflow: "auto" as const,
  };

  return (
    <div style={layoutStyle}>
      <Header />
      <main style={contentStyle}>{children}</main>
    </div>
  );
}
