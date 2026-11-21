/**
 * AI-upscale product photos that are too small to look sharp (for example
 * Amazon `_SX679_` copies). Run it after a bulk import or whenever the upload
 * warning ("photos are small and will look blurry") was ignored.
 *
 *   pnpm images:ai-upscale            # dry run: list the small photos only
 *   pnpm images:ai-upscale --apply    # upscale, upload and switch them over
 *
 * Same as: node --env-file=.env scripts/ai-upscale-product-images.ts [--apply]
 *
 * For each product image whose longest side is under 1400px and that isn't
 * already an AI copy (`…_ai.webp`):
 *   1. download the original
 *   2. enlarge it 4x with Real-ESRGAN (realesrgan-x4plus, runs on the GPU)
 *   3. save a 1600px WebP (quality 85) NEXT TO the original as `…_ai.webp`
 *   4. point the product_images row at it, only if the row still points at
 *      the original (a newer upload is never overwritten)
 * Originals are never deleted. Every change goes to a CSV log in the project
 * root (ai-upscale-product-images-applied-<time>.csv): to undo, set each row's
 * path back to `previous_path`.
 *
 * Needs:
 * - NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (in .env)
 * - Real-ESRGAN ncnn-vulkan: download realesrgan-ncnn-vulkan-*-windows.zip from
 *   https://github.com/xinntao/Real-ESRGAN/releases (v0.2.5.0), unzip it, and set
 *   REALESRGAN_PATH to the .exe (in .env, or pass --esrgan=<path>). The zip
 *   includes the realesrgan-x4plus model.
 * About 6-16 s per photo on a mid-range GPU.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const BUCKET = "product_images";
const LOW_RES_BELOW = 1400;
const TARGET = 1600;
const AI_SUFFIX = "_ai.webp";

const apply = process.argv.includes("--apply");
const esrganArg = process.argv.find((a) => a.startsWith("--esrgan="))?.slice("--esrgan=".length);
const esrgan = esrganArg ?? process.env.REALESRGAN_PATH ?? "";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (run with --env-file=.env).");
if (apply && !existsSync(esrgan)) {
  throw new Error(
    "Real-ESRGAN not found. Set REALESRGAN_PATH (or --esrgan=<path>) to realesrgan-ncnn-vulkan.exe; see the comment at the top of this script.",
  );
}
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

type Row = { id: string; product_id: string; path: string };
type Small = Row & { width: number; height: number };

async function allImages(): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(BUCKET).select("id, product_id, path").order("id").range(from, from + 999);
    if (error) throw new Error(`Listing product images failed: ${error.message}`);
    rows.push(...(data as Row[]));
    if (!data || data.length < 1000) return rows;
  }
}

function csv(rows: string[][]): string {
  return rows.map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(",")).join("\n");
}

async function main() {
  const work = mkdtempSync(join(tmpdir(), "ai-upscale-"));
  const inDir = join(work, "in");
  const outDir = join(work, "out");
  mkdirSync(inDir);
  mkdirSync(outDir);

  try {
    // 1. Find small originals (and keep a PNG copy of each for Real-ESRGAN).
    const candidates = (await allImages()).filter((r) => !r.path.endsWith(AI_SUFFIX));
    const small: Small[] = [];
    let unreadable = 0;
    for (const row of candidates) {
      const { data: blob, error } = await db.storage.from(BUCKET).download(row.path);
      if (error || !blob) {
        unreadable++;
        continue;
      }
      const input = Buffer.from(await blob.arrayBuffer());
      const meta = await sharp(input).rotate().metadata();
      const width = meta.autoOrient?.width ?? meta.width ?? 0;
      const height = meta.autoOrient?.height ?? meta.height ?? 0;
      if (Math.max(width, height) >= LOW_RES_BELOW) continue;
      small.push({ ...row, width, height });
      if (apply) await sharp(input).rotate().png().toFile(join(inDir, `${row.id}.png`));
    }

    console.log(
      `Checked ${candidates.length} photos (${unreadable} unreadable): ${small.length} under ${LOW_RES_BELOW}px.`,
    );
    for (const s of small.slice(0, 20)) console.log(`  ${Math.max(s.width, s.height)}px  ${s.path.split("/").pop()}`);
    if (small.length > 20) console.log(`  …and ${small.length - 20} more`);

    if (!apply) {
      console.log(small.length ? "Dry run only. Re-run with --apply to upscale them." : "Nothing to do.");
      return;
    }
    if (small.length === 0) return;

    // 2. Real-ESRGAN 4x on the whole folder in one GPU run.
    console.log(`Upscaling ${small.length} photos with Real-ESRGAN…`);
    const run = spawnSync(esrgan, ["-i", inDir, "-o", outDir, "-n", "realesrgan-x4plus", "-f", "png"], {
      stdio: ["ignore", "ignore", "pipe"],
      encoding: "utf8",
    });
    if (run.error) throw new Error(`Real-ESRGAN could not start: ${run.error.message}`);
    if (run.status !== 0) throw new Error(`Real-ESRGAN failed (exit ${run.status}): ${run.stderr?.slice(-400)}`);

    // 3-4. Upload each result next to the original and switch the row over.
    const log: string[][] = [["image_id", "product_id", "previous_path", "new_path", "old_size", "kb", "status"]];
    let switched = 0;
    let failed = 0;
    for (const s of small) {
      const aiFile = join(outDir, `${s.id}.png`);
      try {
        if (!existsSync(aiFile)) throw new Error("no AI output");
        const webp = await sharp(aiFile)
          .resize(TARGET, TARGET, { fit: "inside", kernel: "lanczos3" })
          .webp({ quality: 85 })
          .toBuffer();
        const newPath = `${s.path.replace(/\.[^./]+$/, "")}${AI_SUFFIX}`;
        const { error: upErr } = await db.storage.from(BUCKET).upload(newPath, webp, { contentType: "image/webp", upsert: true });
        if (upErr) throw new Error(`upload: ${upErr.message}`);
        const { data: updated, error: rowErr } = await db
          .from(BUCKET)
          .update({ path: newPath })
          .eq("id", s.id)
          .eq("path", s.path)
          .select("id");
        if (rowErr) throw new Error(`row: ${rowErr.message}`);
        const status = updated?.length ? "ai-upscaled" : "skipped: photo changed since";
        if (updated?.length) switched++;
        log.push([s.id, s.product_id, s.path, newPath, `${s.width}x${s.height}`, String(Math.round(webp.length / 1024)), status]);
        process.stdout.write("+");
      } catch (err) {
        failed++;
        log.push([s.id, s.product_id, s.path, "", `${s.width}x${s.height}`, "", `failed: ${err instanceof Error ? err.message : err}`]);
        process.stdout.write("x");
      }
    }

    const file = `ai-upscale-product-images-applied-${new Date().toISOString().slice(0, 19).replace(/:/g, "")}.csv`;
    writeFileSync(file, csv(log));
    console.log(`\nSwitched ${switched}, failed ${failed} of ${small.length}. Log: ${file}`);
    console.log("The storefront shows the new photos within about 3 minutes (product cache).");
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
