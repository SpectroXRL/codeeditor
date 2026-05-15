export type DomainClassification = 'coding' | 'malicious';

const MALICIOUS_PATTERNS: RegExp[] = [
  /\b(build|make|write)\b.{0,20}\b(malware|ransomware|keylogger|botnet|trojan)\b/i,
  /\b(exploit|bypass|steal|phish|credential dump)\b/i,
  /\b(ddos|dos attack|command and control|c2)\b/i,
  /\b(sql injection|xss payload|csrf exploit)\b/i,
  /\b(ignore\s+all\s+previous\s+instructions|reveal\s+system\s+prompt)\b/i,
];

export function classifyDomain(message: string): DomainClassification {
  for (const pattern of MALICIOUS_PATTERNS) {
    if (pattern.test(message)) {
      return 'malicious';
    }
  }

  return 'coding';
}

export function getDomainRefusalMessage(): string {
  return 'I can only help with safe coding-learning tasks. Please ask about learning code concepts, writing code, debugging, or improving your understanding.';
}
