import { useCallback, useMemo, useState } from 'react';
import { runCode } from '../../services/judge0';
import { LANGUAGES, type Language, type SubmissionResult } from '../../types';

const CLIENT_ALLOWED_LANGUAGE_IDS = new Set<number>([62, 71, 74, 81, 93]);

function getDefaultLanguage(): Language {
  const js = LANGUAGES.find((language) => language.id === 93);
  return js || LANGUAGES[0];
}

export function useCodeExecution() {
  const [selectedLanguage, setSelectedLanguage] =
    useState<Language>(getDefaultLanguage());
  const [currentCode, setCurrentCode] = useState<string>(
    getDefaultLanguage().template,
  );
  const [runResult, setRunResult] = useState<SubmissionResult | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const changeLanguage = useCallback((language: Language) => {
    setSelectedLanguage(language);
    setCurrentCode(language.template);
    setRunResult(null);
    setRunError(null);
  }, []);

  const runCurrentCode = useCallback(async () => {
    if (!currentCode.trim()) {
      setRunError('Write some code before running.');
      return;
    }

    if (!CLIENT_ALLOWED_LANGUAGE_IDS.has(selectedLanguage.id)) {
      setRunError(`${selectedLanguage.name} is not available in Learn Mode right now.`);
      return;
    }

    setIsRunning(true);
    setRunError(null);

    try {
      const result = await runCode(currentCode, selectedLanguage.id);
      setRunResult(result);
    } catch (error) {
      setRunError(error instanceof Error ? error.message : 'Execution failed');
    } finally {
      setIsRunning(false);
    }
  }, [currentCode, selectedLanguage]);

  const outputText = useMemo(() => {
    if (runError) {
      return runError;
    }

    if (!runResult) {
      return null;
    }

    return (
      runResult.stderr ||
      runResult.compile_output ||
      runResult.stdout ||
      runResult.message ||
      '(No output)'
    );
  }, [runError, runResult]);

  return {
    selectedLanguage,
    currentCode,
    runResult,
    runError,
    outputText,
    isRunning,
    setCurrentCode,
    setRunResult,
    changeLanguage,
    runCurrentCode,
  };
}
