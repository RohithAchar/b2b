const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

export function publicImageUrl(bucket: string, path: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}

type SniffedType =
  | "image/jpeg"
  | "image/png"
  | "image/webp"
  | "application/pdf"
  | null;

const SUPPORTED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export function isSupportedImageType(mime: string | null | undefined): boolean {
  return (SUPPORTED_IMAGE_MIME_TYPES as readonly string[]).includes(mime ?? "");
}

/**
 * Detect the true file type from magic bytes. The client-controlled
 * `file.type` header is untrusted, so server-side validation must sniff the
 * first bytes of the file content.
 */
export async function sniffImageType(file: File): Promise<SniffedType> {
  const head = new Uint8Array(await file.slice(0, 12).arrayBuffer());

  // JPEG: FF D8 FF
  if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) {
    return "image/jpeg";
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    head[0] === 0x89 &&
    head[1] === 0x50 &&
    head[2] === 0x4e &&
    head[3] === 0x47 &&
    head[4] === 0x0d &&
    head[5] === 0x0a &&
    head[6] === 0x1a &&
    head[7] === 0x0a
  ) {
    return "image/png";
  }

  // WEBP: "RIFF" .... "WEBP"
  if (
    head[0] === 0x52 &&
    head[1] === 0x49 &&
    head[2] === 0x46 &&
    head[3] === 0x46 &&
    head[8] === 0x57 &&
    head[9] === 0x45 &&
    head[10] === 0x42 &&
    head[11] === 0x50
  ) {
    return "image/webp";
  }

  // PDF: %PDF
  if (head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46) {
    return "application/pdf";
  }

  return null;
}

export async function sniffSupportedDoc(
  file: File,
  allowed: ("image" | "pdf")[] = ["image", "pdf"],
): Promise<string | null> {
  const detected = await sniffImageType(file);
  if (allowed.includes("image") && isSupportedImageType(detected)) {
    return detected;
  }
  if (allowed.includes("pdf") && detected === "application/pdf") {
    return detected;
  }
  return null;
}