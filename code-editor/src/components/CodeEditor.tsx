import Editor from "@monaco-editor/react";
import type { Language } from "../types";

interface CodeEditorProps {
  code: string;
  language: Language;
  theme: "vs-dark" | "light";
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function CodeEditor({
  code,
  language,
  theme,
  onChange,
  disabled = false,
}: CodeEditorProps) {
  const handleEditorChange = (value: string | undefined) => {
    onChange(value || "");
  };

  return (
    <div className="code-editor">
      <Editor
        height="100%"
        language={language.monacoLanguage}
        value={code}
        theme={theme}
        onChange={handleEditorChange}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          lineNumbers: "on",
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          wordWrap: "on",
          readOnly: disabled,
        }}
      />
    </div>
  );
}
