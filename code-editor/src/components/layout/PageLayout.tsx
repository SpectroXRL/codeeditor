import type { ReactNode } from "react";
import { Header } from "./Header";
import "./PageLayout.css";

interface PageLayoutProps {
  children: ReactNode;
}

export function PageLayout({ children }: PageLayoutProps) {
  return (
    <div className="page-layout">
      <Header />
      <main className="page-content">{children}</main>
    </div>
  );
}
