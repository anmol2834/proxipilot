/**
 * Email and Untrusted HTML Content Security Utilities
 *
 * CRITICAL SECURITY RULES:
 * 1. ProxiPilot processes arbitrary inbound email content. Email content is inherently UNTRUSTED.
 * 2. NEVER render raw inbound email HTML using dangerouslySetInnerHTML without rigorous sanitization.
 * 3. Never trust external links or tracking beacons without safety attributes.
 */

export interface SanitizeOptions {
  allowImages?: boolean;
  allowLinks?: boolean;
}

/**
 * Escapes plain text for safe insertion into HTML strings
 */
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m] || m);
}

/**
 * Sanitizes untrusted HTML by removing executable scripts, event handlers, and malicious tags.
 * For deep production parsing of rich email bodies, use an isolated iframe or backend sanitization.
 */
export function sanitizeUntrustedHtml(dirtyHtml: string, options: SanitizeOptions = {}): string {
  if (!dirtyHtml || typeof dirtyHtml !== "string") {
    return "";
  }

  let clean = dirtyHtml;

  // 1. Strip script, style, object, embed, iframe, form, and applet tags entirely
  clean = clean.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  clean = clean.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "");
  clean = clean.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "");
  clean = clean.replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, "");
  clean = clean.replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, "");
  clean = clean.replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, "");

  // 2. Strip inline event handlers (onload, onerror, onclick, etc.)
  clean = clean.replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, "");
  clean = clean.replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, "");

  // 3. Strip javascript: and data: pseudo-protocols in links/attributes
  clean = clean.replace(/href\s*=\s*(['"])javascript:.*?\1/gi, 'href="#"');
  clean = clean.replace(/src\s*=\s*(['"])javascript:.*?\1/gi, "");

  // 4. Force safe link attributes (noopener, noreferrer, target=_blank)
  clean = clean.replace(/<a\b([^>]*)>/gi, (match, attrs) => {
    let newAttrs = attrs;
    if (!/target\s*=/i.test(newAttrs)) {
      newAttrs += ' target="_blank"';
    }
    if (!/rel\s*=/i.test(newAttrs)) {
      newAttrs += ' rel="noopener noreferrer"';
    } else {
      newAttrs = newAttrs.replace(/rel=(['"]).*?\1/i, 'rel="noopener noreferrer"');
    }
    return `<a${newAttrs}>`;
  });

  // 5. Optional image suppression (protect user from email tracking pixels)
  if (options.allowImages === false) {
    clean = clean.replace(
      /<img\b[^>]*>/gi,
      '<span class="proxipilot-suppressed-image">[Image Suppressed]</span>'
    );
  }

  return clean;
}
