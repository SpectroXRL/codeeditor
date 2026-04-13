import Editor from "@monaco-editor/react";
import type { Language } from "../types";

interface CodeEditorProps {
  code: string;
  language: Language | string; // Can be Language object or Monaco language string
  theme: "vs-dark" | "light";
  onChange: (value: string) => void;
  disabled?: boolean;
  readOnly?: boolean;
}

export function CodeEditor({
  code,
  language,
  theme,
  onChange,
  disabled = false,
  readOnly = false,
}: CodeEditorProps) {
  const handleEditorChange = (value: string | undefined) => {
    onChange(value || "");
  };

  // Support both Language object and string
  const monacoLanguage =
    typeof language === "string" ? language : language.monacoLanguage;

  return (
    <div className="code-editor">
      <Editor
        height="100%"
        language={monacoLanguage}
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
          readOnly: disabled || readOnly,
        }}
      />
    </div>
  );
}
