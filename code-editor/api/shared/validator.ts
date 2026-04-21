import { isLanguageAllowed, LANGUAGE_NAME_BY_ID } from './languageAllowlist';

export interface ValidationResult {
  valid: boolean;
  sanitized: string;
  blockedReason?: string;
  riskLevel?: 'low' | 'medium' | 'high';
}

const MAX_CHAT_LENGTH = 2500;
const MAX_CODE_LENGTH = 40000;

const HIGH_RISK_PROMPT_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  {
    pattern:
      /ignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?|guidelines?)/i,
    reason: 'Attempted instruction override detected',
  },
  {
    pattern: /show\s+(me\s+)?(your|the)\s+(system\s+)?prompt/i,
    reason: 'System prompt extraction attempt detected',
  },
  {
    pattern: /reveal\s+(your|the)\s+(instructions?|prompt|rules)/i,
    reason: 'System prompt extraction attempt detected',
  },
  {
    pattern: /```system|<\|system\|>|<<SYS>>|\[INST\]/i,
    reason: 'Delimiter injection attempt detected',
  },
];

const DISALLOWED_EXECUTION_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /:\s*\(\s*\)\s*\{\s*:\|:\s*&\s*\};\s*:/, reason: 'Fork bomb pattern detected' },
  { pattern: /Runtime\.getRuntime\(\)\.exec\s*\(/, reason: 'OS command execution is not allowed in this environment' },
  { pattern: /new\s+ProcessBuilder\s*\(/, reason: 'Process spawning is not allowed in this environment' },
  { pattern: /require\(("|')child_process\1\)/, reason: 'child_process usage is not allowed in this environment' },
  { pattern: /from\s+("|')child_process\1/, reason: 'child_process usage is not allowed in this environment' },
  { pattern: /scala\.sys\.process/i, reason: 'Shell process execution is not allowed in this environment' },
];

function sanitizeText(input: string): string {
  return input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/vbscript\s*:/gi, '')
    .replace(/\u0000/g, '')
    .trim();
}

export function validateChatMessage(rawMessage: string): ValidationResult {
  if (!rawMessage || !rawMessage.trim()) {
    return {
      valid: false,
      sanitized: '',
      blockedReason: 'Message cannot be empty',
      riskLevel: 'low',
    };
  }

  if (rawMessage.length > MAX_CHAT_LENGTH) {
    return {
      valid: false,
      sanitized: rawMessage.slice(0, MAX_CHAT_LENGTH),
      blockedReason: `Message exceeds maximum length of ${MAX_CHAT_LENGTH} characters`,
      riskLevel: 'low',
    };
  }

  for (const { pattern, reason } of HIGH_RISK_PROMPT_PATTERNS) {
    if (pattern.test(rawMessage)) {
      return {
        valid: false,
        sanitized: rawMessage,
        blockedReason: reason,
        riskLevel: 'high',
      };
    }
  }

  return {
    valid: true,
    sanitized: sanitizeText(rawMessage),
    riskLevel: 'low',
  };
}

export function validateCode(rawCode: string): ValidationResult {
  if (typeof rawCode !== 'string') {
    return {
      valid: false,
      sanitized: '',
      blockedReason: 'Code must be a string',
      riskLevel: 'low',
    };
  }

  if (!rawCode.trim()) {
    return {
      valid: false,
      sanitized: '',
      blockedReason: 'Code cannot be empty',
      riskLevel: 'low',
    };
  }

  if (rawCode.length > MAX_CODE_LENGTH) {
    return {
      valid: false,
      sanitized: rawCode.slice(0, MAX_CODE_LENGTH),
      blockedReason: `Code exceeds maximum length of ${MAX_CODE_LENGTH} characters`,
      riskLevel: 'medium',
    };
  }

  return {
    valid: true,
    sanitized: rawCode,
    riskLevel: 'low',
  };
}

export function validateExecutionRequest(
  sourceCode: string,
  languageId: number,
): ValidationResult {
  if (!isLanguageAllowed(languageId)) {
    return {
      valid: false,
      sanitized: sourceCode,
      blockedReason: `Language ID ${languageId} is not allowed. Allowed languages: ${Object.entries(
        LANGUAGE_NAME_BY_ID,
      )
        .map(([id, name]) => `${name} (${id})`)
        .join(', ')}`,
      riskLevel: 'medium',
    };
  }

  const codeValidation = validateCode(sourceCode);
  if (!codeValidation.valid) {
    return codeValidation;
  }

  for (const { pattern, reason } of DISALLOWED_EXECUTION_PATTERNS) {
    if (pattern.test(sourceCode)) {
      return {
        valid: false,
        sanitized: sourceCode,
        blockedReason: reason,
        riskLevel: 'high',
      };
    }
  }

  return {
    valid: true,
    sanitized: sourceCode,
    riskLevel: 'low',
  };
}

export function getSafeBlockMessage(blockedReason: string): string {
  const map: Record<string, string> = {
    'Attempted instruction override detected':
      'Please keep the request focused on your coding task instead of trying to modify assistant instructions.',
    'System prompt extraction attempt detected':
      'That request is not supported. Ask about coding concepts, your code, or debugging instead.',
    'Delimiter injection attempt detected':
      'Please remove unsupported prompt formatting and ask your coding question in plain text.',
  };

  return map[blockedReason] || 'Your request was blocked for safety reasons. Please rephrase it as a coding-learning request.';
}
