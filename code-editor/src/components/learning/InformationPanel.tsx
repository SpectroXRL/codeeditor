import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Content } from "../../types/database";
import "./InformationPanel.css";

interface InformationPanelProps {
  content: Content | null;
  loading?: boolean;
}

export function InformationPanel({
  content,
  loading = false,
}: InformationPanelProps) {
  if (loading) {
    return (
      <div className="information-panel">
        <div className="info-loading">
          <div className="spinner"></div>
          <p>Loading lesson...</p>
        </div>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="information-panel">
        <div className="info-empty">
          <p>Select a lesson to begin</p>
        </div>
      </div>
    );
  }

  return (
    <div className="information-panel">
      <div className="info-header">
        <h2>{content.title}</h2>
      </div>
      <div className="info-content markdown-body">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {content.information}
        </ReactMarkdown>
      </div>
    </div>
  );
}
