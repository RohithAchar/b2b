// Server-side HTML sanitization for rich-text product descriptions. Kept
// separate from rich-text.ts so client components never bundle sanitize-html.
import sanitizeHtml from "sanitize-html";

const RICH_TEXT_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p",
    "br",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "s",
    "strike",
    "ul",
    "ol",
    "li",
    "h2",
    "h3",
    "blockquote",
    "code",
    "pre",
    "hr",
    "a",
  ],
  allowedAttributes: {
    a: ["href", "target", "rel"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  transformTags: {
    a: sanitizeHtml.simpleTransform(
      "a",
      { target: "_blank", rel: "noopener noreferrer nofollow" },
      true,
    ),
  },
};

export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html ?? "", RICH_TEXT_OPTIONS).trim();
}