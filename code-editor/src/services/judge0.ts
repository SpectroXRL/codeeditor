import type { SubmissionResult } from '../types';

// Types for test cases
export interface TestCase {
  input: string;
  expected_output: string;
}

export interface TestResult {
  input: string;
  expected: string;
  actual: string;
  passed: boolean;
  stderr: string | null;
  compileOutput: string | null;
}

// Execute code via serverless function
export async function executeCode(
  sourceCode: string,
  languageId: number,
  stdin: string = ''
): Promise<SubmissionResult> {
  const response = await fetch('/api/execute-code', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sourceCode,
      languageId,
      stdin,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Execution failed' }));
    throw new Error(error.error || `Execution failed: ${response.status}`);
  }

  return response.json();
}

// Run multiple test cases and return results
export async function runTestCases(
  sourceCode: string,
  languageId: number,
  testCases: TestCase[]
): Promise<TestResult[]> {
  const results: TestResult[] = [];

  for (const testCase of testCases) {
    try {
      const result = await executeCode(sourceCode, languageId, testCase.input);

      const actual = (result.stdout || '').trim();
      const expected = testCase.expected_output.trim();
      const passed = actual === expected;

      results.push({
        input: testCase.input,
        expected: testCase.expected_output,
        actual: result.stdout || result.stderr || result.compile_output || '',
        passed,
        stderr: result.stderr,
        compileOutput: result.compile_output,
      });
    } catch (error) {
      results.push({
        input: testCase.input,
        expected: testCase.expected_output,
        actual: error instanceof Error ? error.message : 'Execution failed',
        passed: false,
        stderr: error instanceof Error ? error.message : 'Execution failed',
        compileOutput: null,
      });
    }
  }

  return results;
}
