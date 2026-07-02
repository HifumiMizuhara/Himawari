function stripControlChars(text: string): string {
  let cleaned = '';
  for (const char of text) {
    const code = char.charCodeAt(0);
    if (code <= 0x1f && code !== 0x09 && code !== 0x0a && code !== 0x0d) {
      continue;
    }
    cleaned += char;
  }
  return cleaned;
}

/** Strip tags and collapse whitespace from untrusted provider error text. */
export function truncatePlainText(text: string, maxLength = 240): string {
  const cleaned = stripControlChars(text).replace(/\s+/g, ' ').trim();
  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, maxLength)}…`;
}

function extractJsonErrorMessage(raw: string): string | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const nestedError = parsed.error;
    const candidates = [
      typeof nestedError === 'object' && nestedError !== null
        ? (nestedError as { message?: string }).message
        : null,
      typeof nestedError === 'string' ? nestedError : null,
      typeof parsed.message === 'string' ? parsed.message : null,
    ].filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

    return candidates[0] ? truncatePlainText(candidates[0]) : null;
  } catch {
    return null;
  }
}

/** Normalize provider error bodies into short, display-safe plain text. */
export function sanitizeApiErrorDetails(raw: string, maxLength = 240): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';

  const jsonMessage = extractJsonErrorMessage(trimmed);
  if (jsonMessage) return jsonMessage;

  const withoutTags = trimmed.replace(/<[^>]*>/g, ' ');
  return truncatePlainText(withoutTags, maxLength);
}
