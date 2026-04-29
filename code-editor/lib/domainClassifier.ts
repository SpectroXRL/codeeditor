export type DomainClassification = 'coding' | 'off-topic' | 'malicious';

const MALICIOUS_PATTERNS: RegExp[] = [
  /\b(build|make|write)\b.{0,20}\b(malware|ransomware|keylogger|botnet|trojan)\b/i,
  /\b(exploit|bypass|steal|phish|credential dump)\b/i,
  /\b(ddos|dos attack|command and control|c2)\b/i,
  /\b(sql injection|xss payload|csrf exploit)\b/i,
  /\b(ignore\s+all\s+previous\s+instructions|reveal\s+system\s+prompt)\b/i,
];

const CODING_PATTERNS: RegExp[] = [
  /\b(code|programming|algorithm|function|variable|loop|class|object|array)\b/i,
  /\b(javascript|typescript|java|python|scala|node|react|html|css|sql)\b/i,
  /\b(debug|refactor|compile|runtime|syntax|error|test case|output)\b/i,
  /\b(learn|teach|understand|practice|challenge)\b/i,
];

export function classifyDomain(message: string): DomainClassification {
  for (const pattern of MALICIOUS_PATTERNS) {
    if (pattern.test(message)) {
      return 'malicious';
    }
  }

  for (const pattern of CODING_PATTERNS) {
    if (pattern.test(message)) {
      return 'coding';
    }
  }

  return 'off-topic';
}

export function getDomainRefusalMessage(
  classification: Exclude<DomainClassification, 'coding'>,
): string {
  if (classification === 'malicious') {
    return 'I can only help with safe coding-learning tasks. Please ask about learning code concepts, writing code, debugging, or improving your understanding.';
  }

  return 'Let us keep this session focused on learning to code. Ask about a programming concept, your code, debugging, or a practice challenge.';
}
