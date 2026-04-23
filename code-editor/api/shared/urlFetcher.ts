import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const SAFE_BROWSING_API =
  'https://safebrowsing.googleapis.com/v4/threatMatches:find';

const URL_REGEX = /https:\/\/[^\s<>"'`]+/i;
const FETCH_TIMEOUT_MS = 8000;
const MAX_REDIRECT_HOPS = 3;
const MIN_EXTRACTED_CONTENT_CHARS = 300;
const MAX_RESOURCE_CHARS = 3000;

const BLOCKED_HOST_SUFFIXES = ['.local', '.internal', '.localdomain'];

const SAFE_BROWSING_THREAT_TYPES = [
  'MALWARE',
  'SOCIAL_ENGINEERING',
  'UNWANTED_SOFTWARE',
  'POTENTIALLY_HARMFUL_APPLICATION',
] as const;

export interface UrlValidationResult {
  valid: boolean;
  normalizedUrl?: string;
  reason?: string;
}

export interface UrlSafetyResult {
  safe: boolean;
  skipped: boolean;
  reason?: string;
}

interface FetchResult {
  response: Response;
  finalUrl: string;
}

export interface FetchAndExtractResult {
  content: string;
  sourceUrl: string;
  fallbackUsed: boolean;
  failureReason?: string;
}

function stripTrailingPunctuation(url: string): string {
  return url.replace(/[),.;!?]+$/, '');
}

function hostnameIsBlocked(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  if (normalized === 'localhost') {
    return true;
  }

  return BLOCKED_HOST_SUFFIXES.some((suffix) => normalized.endsWith(suffix));
}

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split('.').map((part) => Number.parseInt(part, 10));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return false;
  }

  const [a, b] = parts;

  if (a === 10 || a === 127 || a === 0) {
    return true;
  }

  if (a === 169 && b === 254) {
    return true;
  }

  if (a === 192 && b === 168) {
    return true;
  }

  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }

  return false;
}

function isPrivateIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();

  if (normalized === '::1' || normalized === '::') {
    return true;
  }

  if (
    normalized.startsWith('fe80:') ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd')
  ) {
    return true;
  }

  if (normalized.startsWith('::ffff:')) {
    const mappedIpv4 = normalized.slice('::ffff:'.length);
    return isPrivateIpv4(mappedIpv4);
  }

  return false;
}

function isPrivateIp(ip: string): boolean {
  const ipVersion = isIP(ip);
  if (ipVersion === 4) {
    return isPrivateIpv4(ip);
  }

  if (ipVersion === 6) {
    return isPrivateIpv6(ip);
  }

  return true;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, dec: string) => {
      const code = Number.parseInt(dec, 10);
      return Number.isFinite(code) ? String.fromCharCode(code) : '';
    })
    .replace(/&#x([\da-f]+);/gi, (_, hex: string) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCharCode(code) : '';
    });
}

function extractTagBlock(html: string): string {
  const candidates = [
    /<main\b[^>]*>([\s\S]*?)<\/main>/i,
    /<article\b[^>]*>([\s\S]*?)<\/article>/i,
    /<body\b[^>]*>([\s\S]*?)<\/body>/i,
  ];

  for (const pattern of candidates) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  return html;
}

function htmlToText(html: string): string {
  const withoutNoise = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, ' ')
    .replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, ' ')
    .replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, ' ')
    .replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, ' ')
    .replace(/<aside\b[^<]*(?:(?!<\/aside>)<[^<]*)*<\/aside>/gi, ' ');

  const focused = extractTagBlock(withoutNoise);
  const noTags = focused.replace(/<[^>]+>/g, ' ');
  const decoded = decodeHtmlEntities(noTags);

  return decoded.replace(/\s+/g, ' ').trim();
}

function withTimeout(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

async function resolveHostIp(hostname: string): Promise<string | null> {
  try {
    const result = await lookup(hostname);
    return result.address;
  } catch {
    return null;
  }
}

async function fetchWithRedirects(initialUrl: string): Promise<FetchResult> {
  let currentUrl = initialUrl;

  for (let hop = 0; hop <= MAX_REDIRECT_HOPS; hop += 1) {
    const response = await fetch(currentUrl, {
      method: 'GET',
      redirect: 'manual',
      signal: withTimeout(FETCH_TIMEOUT_MS),
      headers: {
        'User-Agent': 'CodeEditorLearnBot/1.0 (+docs-reader)',
        Accept: 'text/html,application/xhtml+xml;q=0.9,text/plain;q=0.8,*/*;q=0.5',
      },
    });

    const isRedirect = response.status >= 300 && response.status < 400;
    if (!isRedirect) {
      return {
        response,
        finalUrl: currentUrl,
      };
    }

    const location = response.headers.get('location');
    if (!location) {
      throw new Error('Redirect response missing location header');
    }

    if (hop >= MAX_REDIRECT_HOPS) {
      throw new Error('Too many redirects');
    }

    const resolved = new URL(location, currentUrl).toString();
    const validation = await validateUrl(resolved);
    if (!validation.valid || !validation.normalizedUrl) {
      throw new Error(validation.reason || 'Redirect target was blocked');
    }

    currentUrl = validation.normalizedUrl;
  }

  throw new Error('Unable to fetch URL');
}

async function fetchJinaExtract(url: string): Promise<string> {
  const jinaUrl = `https://r.jina.ai/${url}`;
  const response = await fetch(jinaUrl, {
    method: 'GET',
    signal: withTimeout(FETCH_TIMEOUT_MS),
    headers: {
      'User-Agent': 'CodeEditorLearnBot/1.0 (+docs-reader)',
      Accept: 'text/plain, text/markdown;q=0.9, */*;q=0.4',
    },
  });

  if (!response.ok) {
    throw new Error(`Jina fallback failed: ${response.status}`);
  }

  return (await response.text()).replace(/\s+/g, ' ').trim();
}

function truncateForModel(text: string): string {
  if (text.length <= MAX_RESOURCE_CHARS) {
    return text;
  }

  return `${text.slice(0, MAX_RESOURCE_CHARS)}...`;
}

export function extractFirstUrl(message: string): string | null {
  const match = message.match(URL_REGEX);
  if (!match?.[0]) {
    return null;
  }

  return stripTrailingPunctuation(match[0]);
}

export async function validateUrl(rawUrl: string): Promise<UrlValidationResult> {
  if (!rawUrl.trim()) {
    return {
      valid: false,
      reason: 'URL is empty',
    };
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    return {
      valid: false,
      reason: 'URL is invalid',
    };
  }

  if (parsedUrl.protocol !== 'https:') {
    return {
      valid: false,
      reason: 'Only https URLs are allowed',
    };
  }

  if (parsedUrl.username || parsedUrl.password) {
    return {
      valid: false,
      reason: 'URLs with embedded credentials are not allowed',
    };
  }

  if (hostnameIsBlocked(parsedUrl.hostname)) {
    return {
      valid: false,
      reason: 'Local or internal hostnames are blocked',
    };
  }

  const hostIp = await resolveHostIp(parsedUrl.hostname);
  if (!hostIp) {
    return {
      valid: false,
      reason: 'Unable to resolve URL hostname',
    };
  }

  if (isPrivateIp(hostIp)) {
    return {
      valid: false,
      reason: 'Private or loopback addresses are blocked',
    };
  }

  return {
    valid: true,
    normalizedUrl: parsedUrl.toString(),
  };
}

export async function checkUrlSafety(url: string): Promise<UrlSafetyResult> {
  const apiKey = process.env.GOOGLE_SAFE_BROWSING_API_KEY;
  if (!apiKey) {
    return {
      safe: true,
      skipped: true,
      reason: 'Google Safe Browsing key not configured',
    };
  }

  try {
    const response = await fetch(`${SAFE_BROWSING_API}?key=${apiKey}`, {
      method: 'POST',
      signal: withTimeout(FETCH_TIMEOUT_MS),
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client: {
          clientId: 'code-editor-learn-mode',
          clientVersion: '1.0.0',
        },
        threatInfo: {
          threatTypes: SAFE_BROWSING_THREAT_TYPES,
          platformTypes: ['ANY_PLATFORM'],
          threatEntryTypes: ['URL'],
          threatEntries: [{ url }],
        },
      }),
    });

    if (!response.ok) {
      console.warn(`Safe Browsing request failed with status ${response.status}`);
      return {
        safe: true,
        skipped: true,
        reason: 'Safe Browsing request failed',
      };
    }

    const payload = (await response.json().catch(() => ({}))) as {
      matches?: Array<{ threatType?: string }>;
    };

    if (Array.isArray(payload.matches) && payload.matches.length > 0) {
      const threat = payload.matches[0]?.threatType || 'unsafe content';
      return {
        safe: false,
        skipped: false,
        reason: `URL flagged by Safe Browsing (${threat})`,
      };
    }

    return {
      safe: true,
      skipped: false,
    };
  } catch (error) {
    console.warn('Safe Browsing check failed:', error);
    return {
      safe: true,
      skipped: true,
      reason: 'Safe Browsing check unavailable',
    };
  }
}

export async function fetchAndExtract(url: string): Promise<FetchAndExtractResult> {
  let resolvedUrl = url;

  try {
    const { response, finalUrl } = await fetchWithRedirects(url);
    resolvedUrl = finalUrl;

    if (!response.ok) {
      throw new Error(`URL fetch failed with status ${response.status}`);
    }

    const contentType = response.headers.get('content-type')?.toLowerCase() || '';
    if (!contentType.startsWith('text/html')) {
      throw new Error('Unsupported content type for lesson extraction');
    }

    const html = await response.text();
    const extracted = htmlToText(html);

    if (extracted.length >= MIN_EXTRACTED_CONTENT_CHARS) {
      return {
        content: truncateForModel(extracted),
        sourceUrl: resolvedUrl,
        fallbackUsed: false,
      };
    }
  } catch (error) {
    console.warn('Primary URL extraction failed:', error);
  }

  try {
    const fallbackText = await fetchJinaExtract(resolvedUrl);
    if (fallbackText.length >= MIN_EXTRACTED_CONTENT_CHARS) {
      return {
        content: truncateForModel(fallbackText),
        sourceUrl: resolvedUrl,
        fallbackUsed: true,
      };
    }
  } catch (fallbackError) {
    console.warn('Jina fallback extraction failed:', fallbackError);
  }

  return {
    content: '',
    sourceUrl: resolvedUrl,
    fallbackUsed: true,
    failureReason:
      'Content could not be read automatically. The page may require JavaScript rendering or blocked scraping.',
  };
}