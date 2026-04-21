import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Content } from "../../../types/database";
import { Panel } from "../../shared";
import "./panels.css";

interface InformationPanelProps {
  content: Content | null;
  loading?: boolean;
}

export function InformationPanel({
  content,
  loading = false,
}: InformationPanelProps) {
  return (
    <Panel
      header={content ? { title: content.title } : undefined}
      isLoading={loading}
      loadingMessage="Loading lesson..."
      isEmpty={!content}
      emptyMessage="Select a lesson to begin"
      className="information-panel"
    >
      <div className="info-content markdown-body">
        {content && (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {content.information}
          </ReactMarkdown>
        )}
      </div>
    </Panel>
  );
}
