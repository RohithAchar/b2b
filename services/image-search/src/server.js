/**
 * Standalone CLIP image-embedding inference service.
 *
 * Owns ALL ML execution for image search: Transformers.js + onnxruntime-node +
 * model weights live only here, never in the Vercel Next.js bundle.
 *
 * Endpoints:
 *   GET  /health  -> { ok, model, dim, warm } (no auth; for load-balancer checks)
 *   POST /embed   -> multipart field "image", Bearer auth, returns
 *                    { embedding, model, dim }
 *
 * The model loads once per process (at startup, with lazy retry on first
 * request if startup load failed) and is reused between requests. Weights are
 * downloaded once into the HF cache at build/first-boot, never per request.
 * A simple promise-chain serialises inference so concurrent uploads queue
 * instead of running CLIP in parallel on a CPU box.
 */

import http from "node:http";

const MODEL = process.env.IMAGE_SEARCH_MODEL ?? "Xenova/clip-vit-base-patch32";
const DIM = 512;
const DTYPE = "q8";
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const PORT = Number(process.env.PORT ?? 8000);
const TOKEN = process.env.IMAGE_SEARCH_SERVICE_TOKEN ?? "";

let extractorPromise = null;
let warm = false;

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return "?";
  return bytes >= 1 << 20 ? `${(bytes / (1 << 20)).toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
}

/**
 * Single-line progress bar for the first-boot weight download (~89 MB).
 * TTY: rewrites one line via \r. Non-TTY (docker logs): throttled % lines.
 */
function makeDownloadReporter() {
  const isTTY = Boolean(process.stderr.isTTY);
  const seen = new Map(); // file -> last reported percent bucket
  const WIDTH = 20;
  return (info) => {
    const { status, file, progress, loaded, total } = info ?? {};
    if (status !== "progress" || !file || !Number.isFinite(progress)) return;
    const pct = Math.floor(progress);
    if (seen.get(file) === pct) return;
    seen.set(file, pct);
    const bar = "█".repeat(Math.round((pct / 100) * WIDTH)).padEnd(WIDTH, "░");
    const detail = total ? `${formatBytes(loaded)} / ${formatBytes(total)}` : formatBytes(loaded);
    const line = `[inference] ${file} ${bar} ${pct}% (${detail})`;
    if (isTTY) {
      process.stderr.write(`\r\x1b[2K${line}`);
      if (pct >= 100) process.stderr.write("\n");
    } else if (pct === 100 || pct % 10 === 0) {
      console.info(line);
    }
  };
}

function loadModel() {
  if (!extractorPromise) {
    extractorPromise = (async () => {
      console.info(`[inference] loading model ${MODEL} ${DTYPE} …`);
      const { pipeline } = await import("@huggingface/transformers");
      const extractor = await pipeline("image-feature-extraction", MODEL, {
        dtype: DTYPE,
        progress_callback: makeDownloadReporter(),
      });
      warm = true;
      console.info(`[inference] model ready: ${MODEL} ${DTYPE}`);
      return extractor;
    })().catch((err) => {
      extractorPromise = null;
      throw err;
    });
  }
  return extractorPromise;
}

// Serialise inference: one CLIP run at a time.
let queue = Promise.resolve();
function runSerialized(work) {
  const next = queue.then(work, work);
  queue = next.catch(() => {});
  return next;
}

function normalize(values) {
  let s = 0;
  for (const v of values) s += v * v;
  const norm = Math.sqrt(s);
  if (!Number.isFinite(norm) || norm === 0) throw new Error("unusable vector");
  return values.map((v) => v / norm);
}

function sniffType(buf) {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) return "image/png";
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) return "image/webp";
  return null;
}

function json(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(data),
  });
  res.end(data);
}

/** Minimal multipart parser: extracts the single "image" file part. */
function parseImagePart(req, contentType) {
  const m = /boundary=(?:"([^"]+)"|([^\s;]+))/.exec(contentType ?? "");
  const boundary = m?.[1] ?? m?.[2];
  if (!boundary) throw Object.assign(new Error("bad multipart"), { status: 400 });
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_UPLOAD_BYTES + 1024 * 1024) {
        reject(Object.assign(new Error("too large"), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      try {
        const body = Buffer.concat(chunks);
        const sep = Buffer.from(`--${boundary}`);
        const start = body.indexOf(sep);
        if (start < 0) throw Object.assign(new Error("no part"), { status: 400 });
        const headerEnd = body.indexOf("\r\n\r\n", start);
        if (headerEnd < 0) throw Object.assign(new Error("bad part"), { status: 400 });
        const headers = body.subarray(start, headerEnd).toString("latin1");
        if (!/name="image"/.test(headers)) {
          const err = new Error("missing image field");
          err.status = 400;
          err.code = "missing_image";
          throw err;
        }
        const dataStart = headerEnd + 4;
        const endMarker = body.lastIndexOf(Buffer.from("\r\n--" + boundary));
        if (endMarker < 0) throw Object.assign(new Error("bad part"), { status: 400 });
        const file = body.subarray(dataStart, endMarker);
        resolve(file);
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && (req.url === "/health" || req.url === "/healthz")) {
    json(res, 200, { ok: true, model: MODEL, dim: DIM, warm });
    return;
  }
  if (req.method !== "POST" || (req.url !== "/embed" && req.url !== "/embed/")) {
    json(res, 404, { error: "not found", code: "not_found" });
    return;
  }

  // Auth before reading the body.
  const auth = req.headers.authorization ?? "";
  if (!TOKEN || auth !== `Bearer ${TOKEN}`) {
    json(res, 401, { error: "unauthorized", code: "unauthorized" });
    return;
  }

  let bytes;
  try {
    bytes = await parseImagePart(req, req.headers["content-type"]);
  } catch (e) {
    const status = e.status ?? 400;
    json(res, status, { error: e.code === "missing_image" ? "Choose a photo to search with." : "Could not read that upload.", code: e.code ?? "bad_request" });
    return;
  }

  if (bytes.length === 0) {
    json(res, 400, { error: "Choose a photo to search with.", code: "missing_image" });
    return;
  }
  if (bytes.length > MAX_UPLOAD_BYTES) {
    json(res, 413, { error: "Photos must be under 5 MB.", code: "image_too_large" });
    return;
  }
  if (!sniffType(bytes)) {
    json(res, 415, { error: "Use a JPEG, PNG or WebP photo.", code: "unsupported_format" });
    return;
  }

  try {
    const embedding = await runSerialized(async () => {
      const extractor = await loadModel();
      const blob = new Blob([bytes]);
      const output = await extractor(blob);
      const batched = output.tolist();
      const vector = [];
      for (const entry of batched) {
        if (Array.isArray(entry)) vector.push(...entry);
        else vector.push(entry);
      }
      if (vector.length !== DIM || vector.some((v) => !Number.isFinite(v))) {
        throw new Error("malformed embedding");
      }
      return normalize(vector);
    });
    json(res, 200, { embedding, model: MODEL, dim: DIM });
  } catch (err) {
    console.error(`[inference] embed failed: ${err?.message ?? err}`);
    json(res, 422, { error: "Couldn't read that photo.", code: "embedding_failed" });
  }
});

server.listen(PORT, () => console.info(`[inference] listening on :${PORT} model=${MODEL}`));

// Warm the model at boot without blocking listen; failures retry lazily.
loadModel().catch((err) => console.error(`[inference] startup load failed, will retry on first request: ${err?.message ?? err}`));
