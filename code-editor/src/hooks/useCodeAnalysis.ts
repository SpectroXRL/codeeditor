import { useState, useEffect, useRef, useMemo } from 'react';
import type { DetectedIssue } from '../types';

interface UseCodeAnalysisOptions {
  code: string;
  languageId: number;
  starterCode: string;
  enabled?: boolean;
}

interface UseCodeAnalysisResult {
  issues: DetectedIssue[];
  hasTip: boolean;
  primaryIssue: DetectedIssue | null;
}

// Language ID constants (from Judge0)
const LANGUAGE_PYTHON = 71;
const LANGUAGE_JAVA = 62;
const LANGUAGE_JAVASCRIPT = 63;

const DEBOUNCE_MS = 800;

/**
 * Hook for rule-based code analysis to detect common beginner issues
 * Returns detected issues and whether a tip is available
 */
export function useCodeAnalysis({
  code,
  languageId,
  starterCode,
  enabled = true,
}: UseCodeAnalysisOptions): UseCodeAnalysisResult {
  const [issues, setIssues] = useState<DetectedIssue[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevCodeRef = useRef<string>('');

  useEffect(() => {
    if (!enabled) {
      return;
    }

    // Clear previous timeout
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Skip if code hasn't changed
    if (code === prevCodeRef.current) {
      return;
    }

    debounceRef.current = setTimeout(() => {
      prevCodeRef.current = code;
      const detected = analyzeCode(code, languageId, starterCode);
      setIssues(detected);
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [code, languageId, starterCode, enabled]);

  // Return empty issues when disabled - memoize to avoid dependency changes
  const effectiveIssues = useMemo(
    () => (enabled ? issues : []),
    [enabled, issues]
  );
  const hasTip = effectiveIssues.length > 0;
  const primaryIssue = effectiveIssues.length > 0 ? effectiveIssues[0] : null;

  return useMemo(
    () => ({ issues: effectiveIssues, hasTip, primaryIssue }),
    [effectiveIssues, hasTip, primaryIssue]
  );
}

/**
 * Analyze code for common beginner issues
 */
function analyzeCode(
  code: string,
  languageId: number,
  starterCode: string
): DetectedIssue[] {
  const issues: DetectedIssue[] = [];
  const trimmedCode = code.trim();
  const trimmedStarter = starterCode.trim();

  // Skip analysis if code is empty
  if (!trimmedCode) {
    return issues;
  }

  // 1. Unchanged starter code
  if (trimmedCode === trimmedStarter) {
    issues.push({
      type: 'incomplete',
      severity: 'info',
      message: "You haven't modified the starter code yet",
      suggestedTier: 'tip',
    });
    return issues; // Return early - no point analyzing unchanged code
  }

  // Language-specific analysis
  if (languageId === LANGUAGE_PYTHON) {
    issues.push(...analyzePython(code));
  } else if (languageId === LANGUAGE_JAVA) {
    issues.push(...analyzeJava(code));
  } else if (languageId === LANGUAGE_JAVASCRIPT) {
    issues.push(...analyzeJavaScript(code));
  }

  // Common cross-language checks
  issues.push(...analyzeCommon(code));

  return issues;
}

/**
 * Python-specific code analysis
 */
function analyzePython(code: string): DetectedIssue[] {
  const issues: DetectedIssue[] = [];
  const lines = code.split('\n');

  // Check for empty function body (only pass or empty after def)
  const defPattern = /^(\s*)def\s+\w+.*:\s*$/;
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(defPattern);
    if (match) {
      const indent = match[1].length;
      const nextLine = lines[i + 1];
      if (nextLine !== undefined) {
        const nextContent = nextLine.trim();
        const nextIndent = nextLine.length - nextLine.trimStart().length;
        
        // Check if next line is just 'pass' or empty/comment with same indentation
        if (
          nextIndent > indent &&
          (nextContent === 'pass' || nextContent === '' || nextContent.startsWith('#'))
        ) {
          // Check if there's no real code after
          let hasRealCode = false;
          for (let j = i + 1; j < lines.length; j++) {
            const line = lines[j];
            const lineIndent = line.length - line.trimStart().length;
            if (lineIndent <= indent && line.trim() !== '') break;
            if (lineIndent > indent && line.trim() !== '' && line.trim() !== 'pass' && !line.trim().startsWith('#')) {
              hasRealCode = true;
              break;
            }
          }
          
          if (!hasRealCode) {
            issues.push({
              type: 'incomplete',
              severity: 'warning',
              message: 'Function body is empty or only contains pass',
              line: i + 1,
              suggestedTier: 'question',
            });
          }
        }
      }
    }
  }

  // Check for missing colon after if/for/while/def/class
  const colonPatterns = [
    { pattern: /^\s*(if|elif)\s+.+[^:]\s*$/, keyword: 'if/elif' },
    { pattern: /^\s*else\s*[^:]\s*$/, keyword: 'else' },
    { pattern: /^\s*for\s+.+[^:]\s*$/, keyword: 'for' },
    { pattern: /^\s*while\s+.+[^:]\s*$/, keyword: 'while' },
    { pattern: /^\s*def\s+\w+\s*\([^)]*\)\s*[^:]\s*$/, keyword: 'def' },
    { pattern: /^\s*class\s+\w+.*[^:]\s*$/, keyword: 'class' },
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const { pattern, keyword } of colonPatterns) {
      if (pattern.test(line) && !line.includes('#')) {
        issues.push({
          type: 'syntax',
          severity: 'warning',
          message: `Missing colon after ${keyword} statement`,
          line: i + 1,
          suggestedTier: 'tip',
        });
        break;
      }
    }
  }

  // Check for common typos
  const typos: Array<{ wrong: RegExp; correct: string }> = [
    { wrong: /\bpritn\s*\(/, correct: 'print' },
    { wrong: /\bPritn\s*\(/, correct: 'print' },
    { wrong: /\bretrun\b/, correct: 'return' },
    { wrong: /\bRetrun\b/, correct: 'return' },
    { wrong: /\blne\s*\(/, correct: 'len' },
    { wrong: /\bfro\s+\w+\s+in\b/, correct: 'for' },
    { wrong: /\bwhlile\b/, correct: 'while' },
    { wrong: /\bdefn?\s+\w+\(/, correct: 'def' },
  ];

  for (const { wrong, correct } of typos) {
    if (wrong.test(code)) {
      issues.push({
        type: 'syntax',
        severity: 'warning',
        message: `Possible typo: did you mean '${correct}'?`,
        suggestedTier: 'tip',
      });
      break; // Only report first typo
    }
  }

  // Check for infinite loop indicators
  if (/while\s+True\s*:/.test(code) && !/\bbreak\b/.test(code)) {
    issues.push({
      type: 'logic',
      severity: 'warning',
      message: 'while True loop without break may run forever',
      suggestedTier: 'question',
    });
  }

  // Check for missing print (if function contains return but no print, might be fine)
  // Only flag if there's no output mechanism at all
  const hasPrint = /\bprint\s*\(/.test(code);
  const hasReturn = /\breturn\b/.test(code);
  const hasFunction = /\bdef\s+/.test(code);
  
  if (!hasPrint && !hasReturn && hasFunction) {
    issues.push({
      type: 'incomplete',
      severity: 'info',
      message: 'Your function has no print or return statement',
      suggestedTier: 'question',
    });
  }

  return issues;
}

/**
 * Java-specific code analysis
 */
function analyzeJava(code: string): DetectedIssue[] {
  const issues: DetectedIssue[] = [];

  // Check for missing semicolons (basic check)
  const lines = code.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    // Skip empty lines, comments, block starts/ends
    if (
      !line ||
      line.startsWith('//') ||
      line.startsWith('/*') ||
      line.startsWith('*') ||
      line.endsWith('{') ||
      line.endsWith('}') ||
      line === '}'
    ) {
      continue;
    }
    // Check statements that need semicolons
    if (
      (line.includes('=') || line.startsWith('System.') || line.startsWith('return ')) &&
      !line.endsWith(';') &&
      !line.endsWith('{')
    ) {
      issues.push({
        type: 'syntax',
        severity: 'warning',
        message: 'Missing semicolon at end of statement',
        line: i + 1,
        suggestedTier: 'tip',
      });
      break; // Only report first
    }
  }

  // Check for common typos
  if (/\bSystem\.out\.prtinln\b/.test(code)) {
    issues.push({
      type: 'syntax',
      severity: 'warning',
      message: "Typo: did you mean 'println'?",
      suggestedTier: 'tip',
    });
  }

  return issues;
}

/**
 * JavaScript-specific code analysis
 */
function analyzeJavaScript(code: string): DetectedIssue[] {
  const issues: DetectedIssue[] = [];

  // Check for common typos
  const typos = [
    { wrong: /\bconosle\.log\b/, correct: 'console.log' },
    { wrong: /\bconsoel\.log\b/, correct: 'console.log' },
    { wrong: /\bfunciton\b/, correct: 'function' },
    { wrong: /\bretrun\b/, correct: 'return' },
  ];

  for (const { wrong, correct } of typos) {
    if (wrong.test(code)) {
      issues.push({
        type: 'syntax',
        severity: 'warning',
        message: `Typo: did you mean '${correct}'?`,
        suggestedTier: 'tip',
      });
      break;
    }
  }

  return issues;
}

/**
 * Common cross-language checks
 */
function analyzeCommon(code: string): DetectedIssue[] {
  const issues: DetectedIssue[] = [];

  // Check for unbalanced brackets
  const brackets: Array<[string, string]> = [
    ['(', ')'],
    ['[', ']'],
    ['{', '}'],
  ];

  for (const [open, close] of brackets) {
    const openCount = (code.match(new RegExp(`\\${open}`, 'g')) || []).length;
    const closeCount = (code.match(new RegExp(`\\${close}`, 'g')) || []).length;

    if (openCount > closeCount) {
      issues.push({
        type: 'syntax',
        severity: 'warning',
        message: `Missing closing '${close}' bracket`,
        suggestedTier: 'tip',
      });
    } else if (closeCount > openCount) {
      issues.push({
        type: 'syntax',
        severity: 'warning',
        message: `Extra closing '${close}' bracket`,
        suggestedTier: 'tip',
      });
    }
  }

  return issues;
}
