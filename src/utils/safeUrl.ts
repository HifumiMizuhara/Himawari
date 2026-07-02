const SAFE_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

/** Returns true when href is safe to render as a clickable link. */
export function isSafeHref(href: string): boolean {
  try {
    const url = new URL(href, typeof window !== 'undefined' ? window.location.origin : 'https://example.com');
    return SAFE_PROTOCOLS.has(url.protocol);
  } catch {
    return false;
  }
}

/** Returns a sanitized href or null when the URL is unsafe. */
export function sanitizeHref(href: string | undefined): string | null {
  if (!href || !isSafeHref(href)) return null;
  return href;
}
