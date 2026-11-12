import sharp from "sharp";

export type OptimizeImageOptions = {
  maxDimension?: number;
  targetBytes?: number;
  format?: "webp" | "jpeg";
};

export type OptimizedImage = {
  buffer: Buffer;
  contentType: string;
  extension: string;
  width: number;
  height: number;
};

const DEFAULT_MAX_DIMENSION = 1600;
const DEFAULT_TARGET_BYTES = 100 * 1024;

/**
 * Compress an uploaded image to (at most) `targetBytes` while keeping it
 * readable. Tries a few dimension/quality combinations and returns the first
 * result that fits; otherwise returns the smallest one produced.
 *
 * Server-only: imports `sharp`, so this module must never be imported by
 * client code.
 */
export async function optimizeImageUpload(
  file: File,
  options: OptimizeImageOptions = {},
): Promise<OptimizedImage> {
  const maxDimension = options.maxDimension ?? DEFAULT_MAX_DIMENSION;
  const targetBytes = options.targetBytes ?? DEFAULT_TARGET_BYTES;
  const format = options.format ?? "webp";

  const input = Buffer.from(await file.arrayBuffer());

  const dimensionSteps = [
    maxDimension,
    Math.round(maxDimension * 0.75),
    Math.round(maxDimension * 0.5),
  ];
  const qualitySteps = [70, 60, 50];

  let best: { buffer: Buffer; width: number; height: number } | null = null;

  for (const dim of dimensionSteps) {
    for (const quality of qualitySteps) {
      const pipeline = sharp(input)
        .rotate()
        .resize(dim, dim, { fit: "inside", withoutEnlargement: true });

      const buffer =
        format === "webp"
          ? await pipeline.webp({ quality }).toBuffer()
          : await pipeline.jpeg({ quality, progressive: true, mozjpeg: true }).toBuffer();

      const meta = await sharp(buffer).metadata();
      const width = meta.width ?? dim;
      const height = meta.height ?? dim;

      if (!best || buffer.byteLength < best.buffer.byteLength) {
        best = { buffer, width, height };
      }

      if (buffer.byteLength <= targetBytes) {
        return {
          buffer,
          contentType: format === "webp" ? "image/webp" : "image/jpeg",
          extension: format === "webp" ? "webp" : "jpg",
          width,
          height,
        };
      }
    }
  }

  if (!best) {
    throw new Error("Could not optimize image.");
  }

  return {
    buffer: best.buffer,
    contentType: format === "webp" ? "image/webp" : "image/jpeg",
    extension: format === "webp" ? "webp" : "jpg",
    width: best.width,
    height: best.height,
  };
}