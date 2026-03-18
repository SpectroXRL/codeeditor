import type { SubmissionResult, SubmissionResponse } from '../types';
import { STATUS } from '../types';

const API_URL = 'https://judge0-ce.p.rapidapi.com';
const API_KEY = import.meta.env.VITE_JUDGE0_API_KEY;
const API_HOST = 'judge0-ce.p.rapidapi.com';

const headers = {
  'Content-Type': 'application/json',
  'X-RapidAPI-Key': API_KEY,
  'X-RapidAPI-Host': API_HOST,
};

export async function submitCode(
  sourceCode: string,
  languageId: number,
  stdin: string = ''
): Promise<string> {
  const response = await fetch(`${API_URL}/submissions?base64_encoded=false&wait=false`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      source_code: sourceCode,
      language_id: languageId,
      stdin: stdin,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Submission failed: ${response.status} - ${error}`);
  }

  const data: SubmissionResponse = await response.json();
  return data.token;
}

export async function getSubmission(token: string): Promise<SubmissionResult> {
  const response = await fetch(
    `${API_URL}/submissions/${token}?base64_encoded=false&fields=stdout,stderr,status,compile_output,message,time,memory`,
    {
      method: 'GET',
      headers,
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get submission: ${response.status} - ${error}`);
  }

  const data: SubmissionResult = await response.json();
  return { ...data, token };
}

export async function pollForResult(
  token: string,
  maxAttempts: number = 30,
  intervalMs: number = 1000
): Promise<SubmissionResult> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const result = await getSubmission(token);

    // Check if processing is complete (status > 2 means done)
    if (result.status.id > STATUS.PROCESSING) {
      return result;
    }

    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error('Execution timed out - max polling attempts reached');
}

export async function executeCode(
  sourceCode: string,
  languageId: number,
  stdin: string = ''
): Promise<SubmissionResult> {
  const token = await submitCode(sourceCode, languageId, stdin);
  return pollForResult(token);
}

// Test case types
export interface TestCase {
  input: string;
  expected_output: string;
}

export interface TestResult {
  input: string;
  expected: string;
  actual: string;
  passed: boolean;
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
      });
    } catch (error) {
      results.push({
        input: testCase.input,
        expected: testCase.expected_output,
        actual: error instanceof Error ? error.message : 'Execution failed',
        passed: false,
      });
    }
  }

  return results;
}
