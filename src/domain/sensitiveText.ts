const SENSITIVE_PATTERNS = [
  /\b(?:sk|rk|pk)-(?:proj-)?[a-z0-9_-]{20,}\b/iu,
  /\b(?:api[_ -]?key|access[_ -]?token|authorization)\s*[:=]\s*[^\s]{12,}/iu,
  /\bbearer\s+[a-z0-9._~-]{12,}\b/iu,
]

export function containsSensitiveCredential(value: string): boolean {
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(value))
}
