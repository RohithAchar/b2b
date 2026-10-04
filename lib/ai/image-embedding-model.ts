/**
 * CLIP model identity shared by the Vercel app, the inference service, and the
 * database rows. Client-safe: no server/ML imports, so importing this never
 * pulls Transformers.js into the Next.js bundle.
 */

export const IMAGE_EMBEDDING_MODEL = "Xenova/clip-vit-base-patch32";

/** CLIP ViT-B/32's projected image-embedding width. Must match the migration. */
export const IMAGE_EMBEDDING_DIM = 512;

/** Quantised weights used by the inference service. */
export const IMAGE_EMBEDDING_DTYPE = "q8";
