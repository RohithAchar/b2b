// Dependency-free helpers for rich-text descriptions and SEO field
// generation. Safe to import from client components, server components and
// unit tests (no Node-only modules).

export const DESCRIPTION_MIN_TEXT_CHARS = 50;
export const DESCRIPTION_MAX_HTML_CHARS = 8000;

export const MAX_SEO_TITLE_CHARS = 200;
export const MAX_SEO_DESCRIPTION_CHARS = 400;
export const SEO_TITLE_RECOMMENDED_CHARS = 60;
export const SEO_DESCRIPTION_RECOMMENDED_CHARS = 160;

/**
 * Reduce arbitrary (possibly untrusted) HTML to visible text. Uses the DOM
 * parser when available and a light regex fallback server-side.
 */
export function stripHtml(html: string): string {
  const source = html ?? "";
  if (typeof document !== "undefined") {
    const doc = new DOMParser().parseFromString(source, "text/html");
    return (doc.body.textContent ?? "").replace(/\s+/g, " ").trim();
  }
  return source
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function plainTextLength(html: string): number {
  return stripHtml(html).length;
}

export function truncateTo(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trimEnd()}…`;
}

export function defaultSeoTitle(title: string): string {
  return truncateTo(title.trim() || "Wholesale product", SEO_TITLE_RECOMMENDED_CHARS);
}

export function defaultSeoDescription(descriptionHtml: string): string {
  return truncateTo(stripHtml(descriptionHtml), SEO_DESCRIPTION_RECOMMENDED_CHARS);
}