/**
 * Input Sanitization Service
 * Provides security validation for prompts and code to prevent:
 * - XSS attacks
 * - SQL injection patterns
 * - Prompt injection/jailbreak attempts
 */

export interface ValidationResult {
  valid: boolean;
  sanitized: string;
  blockedReason?: string;
  riskLevel?: 'low' | 'medium' | 'high';
}

// Prompt injection patterns to detect
const PROMPT_INJECTION_PATTERNS: Array<{ pattern: RegExp; reason: string; risk: 'medium' | 'high' }> = [
  // Direct instruction override attempts
  { 
    pattern: /ignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?|guidelines?)/i,
    reason: 'Attempted instruction override detected',
    risk: 'high'
  },
  {
    pattern: /disregard\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?)/i,
    reason: 'Attempted instruction override detected',
    risk: 'high'
  },
  {
    pattern: /forget\s+(everything|all|what)\s+(you('ve)?|i)\s+(told|said|learned)/i,
    reason: 'Attempted memory manipulation detected',
    risk: 'high'
  },
  // Role/identity manipulation
  {
    pattern: /you\s+are\s+now\s+(a|an|the|acting\s+as)/i,
    reason: 'Attempted role manipulation detected',
    risk: 'high'
  },
  {
    pattern: /pretend\s+(to\s+be|you('re)?|that\s+you)/i,
    reason: 'Attempted role manipulation detected',
    risk: 'medium'
  },
  {
    pattern: /act\s+as\s+(if\s+you('re)?|a|an|the)/i,
    reason: 'Attempted role manipulation detected',
    risk: 'medium'
  },
  {
    pattern: /roleplay\s+as/i,
    reason: 'Attempted role manipulation detected',
    risk: 'medium'
  },
  // System prompt extraction
  {
    pattern: /what\s+(is|are)\s+(your|the)\s+(system\s+)?prompt/i,
    reason: 'System prompt extraction attempt detected',
    risk: 'high'
  },
  {
    pattern: /show\s+(me\s+)?(your|the)\s+(system\s+)?prompt/i,
    reason: 'System prompt extraction attempt detected',
    risk: 'high'
  },
  {
    pattern: /reveal\s+(your|the)\s+(instructions?|prompt|rules)/i,
    reason: 'System prompt extraction attempt detected',
    risk: 'high'
  },
  {
    pattern: /print\s+(your|the)\s+(system\s+)?(prompt|instructions?)/i,
    reason: 'System prompt extraction attempt detected',
    risk: 'high'
  },
  // Output manipulation
  {
    pattern: /output\s+(only|just)\s+(the\s+)?(code|answer|result)/i,
    reason: 'Output manipulation attempt detected',
    risk: 'medium'
  },
  {
    pattern: /respond\s+(only\s+)?(with|in)\s+(code|json|xml)/i,
    reason: 'Output format manipulation detected',
    risk: 'low'
  },
  // Encoded payload detection
  {
    pattern: /eval\s*\(\s*atob\s*\(/i,
    reason: 'Encoded payload execution attempt detected',
    risk: 'high'
  },
  {
    pattern: /\\x[0-9a-f]{2}/i,
    reason: 'Hex-encoded content detected',
    risk: 'medium'
  },
  // Delimiter injection
  {
    pattern: /```system|<\|system\|>|<system>|<<SYS>>|\[INST\]/i,
    reason: 'Delimiter injection attempt detected',
    risk: 'high'
  },
  // Multi-turn manipulation
  {
    pattern: /\[end\s+of\s+(conversation|context|prompt)\]/i,
    reason: 'Context boundary manipulation detected',
    risk: 'high'
  },
  {
    pattern: /---+\s*(new|reset|clear)\s*(conversation|context|chat)/i,
    reason: 'Context reset manipulation detected',
    risk: 'high'
  },
];

// XSS patterns for sanitization
const XSS_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  // Script tags
  { pattern: /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, replacement: '' },
  { pattern: /<script\b[^>]*>/gi, replacement: '' },
  { pattern: /<\/script>/gi, replacement: '' },
  // Event handlers
  { pattern: /\bon\w+\s*=\s*["'][^"']*["']/gi, replacement: '' },
  { pattern: /\bon\w+\s*=\s*[^\s>]+/gi, replacement: '' },
  // JavaScript URLs
  { pattern: /javascript\s*:/gi, replacement: '' },
  { pattern: /vbscript\s*:/gi, replacement: '' },
  { pattern: /data\s*:\s*text\/html/gi, replacement: '' },
  // Dangerous tags
  { pattern: /<iframe\b[^>]*>.*?<\/iframe>/gi, replacement: '' },
  { pattern: /<iframe\b[^>]*\/?>/gi, replacement: '' },
  { pattern: /<object\b[^>]*>.*?<\/object>/gi, replacement: '' },
  { pattern: /<embed\b[^>]*\/?>/gi, replacement: '' },
  { pattern: /<link\b[^>]*\/?>/gi, replacement: '' },
  { pattern: /<meta\b[^>]*\/?>/gi, replacement: '' },
  { pattern: /<base\b[^>]*\/?>/gi, replacement: '' },
  // Expression injection
  { pattern: /expression\s*\([^)]*\)/gi, replacement: '' },
  { pattern: /url\s*\(\s*["']?\s*javascript:/gi, replacement: 'url(' },
];

// SQL injection patterns (for audit logging, not code execution)
const SQL_INJECTION_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /;\s*(DROP|DELETE|TRUNCATE|ALTER|UPDATE|INSERT)\s+/i, reason: 'SQL injection pattern detected' },
  { pattern: /'\s*(OR|AND)\s+['"]?\d+['"]?\s*=\s*['"]?\d+/i, reason: 'SQL injection pattern detected' },
  { pattern: /'\s*(OR|AND)\s+['"]?\w+['"]?\s*=\s*['"]?\w+['"]?\s*--/i, reason: 'SQL injection pattern detected' },
  { pattern: /UNION\s+(ALL\s+)?SELECT/i, reason: 'SQL union injection detected' },
  { pattern: /;\s*--/i, reason: 'SQL comment injection detected' },
  { pattern: /\/\*.*?\*\//i, reason: 'SQL block comment detected' },
];

// Maximum prompt length
const MAX_PROMPT_LENGTH = 4000;

/**
 * Sanitize text to remove XSS vectors
 */
export function sanitizeXSS(input: string): string {
  let sanitized = input;
  
  for (const { pattern, replacement } of XSS_PATTERNS) {
    sanitized = sanitized.replace(pattern, replacement);
  }
  
  // HTML entity encode remaining special characters for display safety
  sanitized = sanitized
    .replace(/&(?!(amp|lt|gt|quot|#\d+|#x[0-9a-f]+);)/gi, '&amp;')
    .replace(/<(?!\/?(?:code|pre|strong|em|b|i|u|s|br|p)\b)/gi, '&lt;')
    .replace(/(?<!<\/?(?:code|pre|strong|em|b|i|u|s|br|p))>/gi, '&gt;');
  
  return sanitized;
}

/**
 * Check for prompt injection attempts
 */
export function detectPromptInjection(input: string): { detected: boolean; reason?: string; risk?: 'low' | 'medium' | 'high' } {
  for (const { pattern, reason, risk } of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      return { detected: true, reason, risk };
    }
  }
  return { detected: false };
}

/**
 * Check for SQL injection patterns (for logging/audit purposes)
 */
export function detectSQLInjection(input: string): { detected: boolean; reason?: string } {
  for (const { pattern, reason } of SQL_INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      return { detected: true, reason };
    }
  }
  return { detected: false };
}

/**
 * Validate and sanitize a user prompt
 * Returns validation result with sanitized content or block reason
 */
export function validatePrompt(rawPrompt: string): ValidationResult {
  // Check length
  if (rawPrompt.length > MAX_PROMPT_LENGTH) {
    return {
      valid: false,
      sanitized: rawPrompt.slice(0, MAX_PROMPT_LENGTH),
      blockedReason: `Prompt exceeds maximum length of ${MAX_PROMPT_LENGTH} characters`,
      riskLevel: 'low'
    };
  }
  
  // Empty prompt check
  if (!rawPrompt.trim()) {
    return {
      valid: false,
      sanitized: '',
      blockedReason: 'Prompt cannot be empty',
      riskLevel: 'low'
    };
  }
  
  // Check for prompt injection (high-risk blocks submission)
  const injectionResult = detectPromptInjection(rawPrompt);
  if (injectionResult.detected && injectionResult.risk === 'high') {
    return {
      valid: false,
      sanitized: rawPrompt,
      blockedReason: injectionResult.reason,
      riskLevel: 'high'
    };
  }
  
  // Sanitize XSS (allow submission but sanitize)
  const sanitized = sanitizeXSS(rawPrompt);
  
  // SQL injection detection (log but don't necessarily block for prompts)
  const sqlResult = detectSQLInjection(rawPrompt);
  
  // Medium-risk prompt injection: warn but allow
  if (injectionResult.detected && injectionResult.risk === 'medium') {
    return {
      valid: true,
      sanitized,
      riskLevel: 'medium'
    };
  }
  
  // SQL patterns in prompts: warn but allow (they might be teaching SQL)
  if (sqlResult.detected) {
    return {
      valid: true,
      sanitized,
      riskLevel: 'medium'
    };
  }
  
  return {
    valid: true,
    sanitized,
    riskLevel: 'low'
  };
}

/**
 * Validate code content (for display safety)
 * Less strict than prompt validation - code naturally contains "dangerous" patterns
 */
export function validateCodeForDisplay(code: string): string {
  // For code, we only sanitize actual XSS vectors that could execute in the browser
  // We preserve most content since Monaco editor handles escaping
  let sanitized = code;
  
  // Remove actual script execution attempts in code strings
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '/* script removed */');
  
  return sanitized;
}

/**
 * Check if a prompt appears to be a genuine learning attempt
 * Heuristic to differentiate between actual prompts and jailbreak attempts
 */
export function assessPromptIntent(prompt: string): 'learning' | 'suspicious' | 'blocked' {
  const words = prompt.toLowerCase().split(/\s+/);
  
  // Positive indicators (code-related terms)
  const codeTerms = ['function', 'variable', 'loop', 'array', 'object', 'class', 'return', 
                     'create', 'write', 'implement', 'fix', 'debug', 'add', 'modify',
                     'javascript', 'typescript', 'code', 'program', 'algorithm'];
  
  const codeTermCount = words.filter(w => codeTerms.some(term => w.includes(term))).length;
  
  // Check for prompt injection
  const injectionResult = detectPromptInjection(prompt);
  
  if (injectionResult.detected && injectionResult.risk === 'high') {
    return 'blocked';
  }
  
  if (injectionResult.detected && injectionResult.risk === 'medium' && codeTermCount < 2) {
    return 'suspicious';
  }
  
  return 'learning';
}

/**
 * Generate a safe error message without leaking internal details
 */
export function getSafeBlockMessage(blockedReason: string): string {
  // Map internal reasons to user-friendly messages
  const messageMap: Record<string, string> = {
    'Attempted instruction override detected': 
      'Your prompt contains patterns that aren\'t allowed. Try rephrasing your request to focus on the coding task.',
    'Attempted role manipulation detected':
      'Please focus on describing what code you need rather than how the assistant should behave.',
    'System prompt extraction attempt detected':
      'That type of request isn\'t supported. Try asking for help with your coding challenge instead.',
    'Encoded payload execution attempt detected':
      'Your prompt contains suspicious content. Please write your request in plain text.',
    'Delimiter injection attempt detected':
      'Your prompt contains formatting that isn\'t supported. Please use plain text.',
    'Context boundary manipulation detected':
      'Please focus on the current coding challenge.',
    'Context reset manipulation detected':
      'Please focus on the current coding challenge.',
  };
  
  return messageMap[blockedReason] || 
    'Your prompt was blocked for security reasons. Please rephrase your request to focus on the coding task.';
}
