"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { Download01Icon, Folder01Icon, Image01Icon, Upload01Icon } from "@hugeicons/core-free-icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { createClient } from "@/lib/supabase/client";
import { findLowResImages, lowResWarning, shrinkImageFile } from "@/lib/shrink-image";
import { toast } from "@/components/ui/toast";

/** Advise (never block) when picked photos are too small to look sharp. */
async function warnIfLowRes(files: File[]) {
  const warning = lowResWarning(await findLowResImages(files));
  if (warning) toast.add({ type: "warning", ...warning });
}
import { MAX_PRODUCT_IMAGES } from "@/lib/supplier/products";
import { submitProduct } from "@/lib/supplier/product-actions";
import {
  COLUMN_LABELS,
  IMPORT_CHUNK_SIZE,
  IMPORT_COLUMNS,
  MAX_IMPORT_ROWS,
  cellToText,
  csvToTable,
  groupImagesBySku,
  groupIntoUnits,
  localFileKey,
  localFilesOf,
  missingRequired,
  rowsFromTable,
  suggestMapping,
  templateCsv,
  toCsv,
  validateImportUnit,
  type Category,
  type ImportColumn,
  type ImportRow,
  type ImportUnit,
  type ValidatedUnit,
} from "@/lib/supplier/product-import";
import {
  attachUploadedImages,
  findProductsBySku,
  importProductsChunk,
  type ImportMode,
  type ImportUnitResult,
} from "@/lib/supplier/product-import-actions";

type Valid = Extract<ValidatedUnit, { ok: true }>;
/** A product to import (row or variant group) with its preview check. */
type Planned = { unit: ImportUnit; checked: Valid | null; problem: string | null };
type Mapping = (ImportColumn | "")[];
type Supabase = ReturnType<typeof createClient>;

function downloadCsv(name: string, csv: string) {
  // BOM so Excel opens ₹ and other non-ASCII text correctly.
  const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/** .csv or .xlsx → table of text cells (header first). */
async function readTable(file: File): Promise<string[][]> {
  if (/\.xlsx$/i.test(file.name)) {
    // Loaded only when an Excel file is picked.
    const { readSheet } = await import("read-excel-file/browser");
    const sheet = await readSheet(file);
    return sheet.map((row) => row.map(cellToText)).filter((row) => row.some((c) => c !== ""));
  }
  return csvToTable(await file.text());
}

/**
 * Upload local photos straight to Storage (shrunk first; no 4.5 MB server
 * limit), into the user's own folder where the storage policy allows it.
 */
async function uploadLocal(supabase: Supabase, userId: string, prefix: string, files: File[]): Promise<string[]> {
  // All of a product's photos (≤ 8) upload together, in order; all-or-nothing.
  const results = await Promise.allSettled(
    files.map(async (original, i) => {
      const file = await shrinkImageFile(original);
      const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const path = `${userId}/${prefix}_${Date.now()}_${i}.${ext}`;
      const { error } = await supabase.storage
        .from("product_images")
        .upload(path, file, { contentType: file.type || "image/jpeg", upsert: false });
      if (error) throw new Error(error.message);
      return path;
    }),
  );
  const paths = results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
  const failed = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
  if (failed) {
    if (paths.length) await supabase.storage.from("product_images").remove(paths);
    throw failed.reason;
  }
  return paths;
}

const rowsLabel = (lines: number[]) =>
  lines.length === 1 ? String(lines[0]) : `${lines[0]}–${lines[lines.length - 1]}`;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function ProductImport({ categories }: { categories: Category[] }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const photosRef = useRef<HTMLInputElement>(null);
  const imagesRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [table, setTable] = useState<string[][] | null>(null);
  const [mapping, setMapping] = useState<Mapping>([]);
  const [mode, setMode] = useState<ImportMode>("create");
  // Photos on this computer, keyed by lower-case file name (how the sheet refers to them).
  const [localFiles, setLocalFiles] = useState<Map<string, File>>(new Map());
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [results, setResults] = useState<ImportUnitResult[] | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [imageStatus, setImageStatus] = useState<string | null>(null);
  const [imageBusy, setImageBusy] = useState(false);

  const missing = table ? missingRequired(mapping) : [];
  const rows = useMemo(
    () => (table && missingRequired(mapping).length === 0 ? rowsFromTable(table, mapping) : []),
    [table, mapping],
  );
  const planned: Planned[] = useMemo(
    () =>
      groupIntoUnits(rows.map((row, i) => ({ line: i + 2, row }))).map((unit) => {
        const check = validateImportUnit(unit, categories);
        if (!check.ok) return { unit, checked: null, problem: `Row ${check.line}: ${check.message}` };
        const notFound = localFilesOf(check).filter((name) => !localFiles.has(name));
        if (notFound.length) {
          return {
            unit,
            checked: null,
            problem: `Row ${unit.lines[0]}: photo${notFound.length > 1 ? "s" : ""} not found in the selected folder: ${notFound.join(", ")}`,
          };
        }
        return { unit, checked: check, problem: null };
      }),
    [rows, categories, localFiles],
  );
  const ready = planned.filter((p): p is Planned & { checked: Valid } => p.checked !== null);
  const withProblems = planned.length - ready.length;
  const needsPhotos = planned.some((p) => /not found in the selected folder/.test(p.problem ?? ""));

  function reset() {
    setResults(null);
    setRunError(null);
    setTable(null);
    setMapping([]);
    setFileError(null);
    setImageStatus(null);
  }

  async function onFile(file: File | null) {
    reset();
    setFileName(file?.name ?? null);
    if (!file) return;
    if (!/\.(csv|xlsx)$/i.test(file.name)) {
      setFileError("Upload a .csv or .xlsx file. Older .xls files: open in Excel and save as .xlsx.");
      return;
    }
    try {
      const t = await readTable(file);
      if (t.length < 2) return setFileError("The file has no product rows under the header.");
      if (t.length - 1 > MAX_IMPORT_ROWS) {
        return setFileError(`Up to ${MAX_IMPORT_ROWS} rows per file. Split it into smaller files.`);
      }
      setTable(t);
      setMapping(suggestMapping(t[0]));
    } catch {
      setFileError("Couldn't read this file. Check it opens in Excel, then try again.");
    }
  }

  function onLocalPhotos(files: File[]) {
    if (files.length === 0) return;
    void warnIfLowRes(files.filter((f) => /\.(jpe?g|png|webp)$/i.test(f.name)));
    setLocalFiles((prev) => {
      const next = new Map(prev);
      for (const f of files) if (/\.(jpe?g|png|webp)$/i.test(f.name)) next.set(localFileKey(f.name), f);
      return next;
    });
  }

  /** After a product is saved: upload its local photos / search image, then publish if asked. */
  async function finishProduct(
    supabase: Supabase,
    userId: string,
    productId: string,
    checked: Valid,
  ): Promise<string[]> {
    const warnings: string[] = [];
    const localImages = checked.images.flatMap((r) => (r.kind === "file" ? [localFiles.get(r.name)!] : []));
    const localSearch = checked.searchImage?.kind === "file" ? localFiles.get(checked.searchImage.name)! : null;
    if (localImages.length || localSearch) {
      try {
        const images = await uploadLocal(supabase, userId, productId, localImages);
        const [searchImage] = localSearch ? await uploadLocal(supabase, userId, `seo/${productId}`, [localSearch]) : [];
        const res = await attachUploadedImages(productId, {
          images,
          // Web images (downloaded by the server) come first; local photos follow.
          append: checked.images.some((r) => r.kind === "url"),
          searchImage,
        });
        if (!res.ok) throw new Error(res.message);
      } catch (err) {
        warnings.push(`Photos from your computer not added: ${err instanceof Error ? err.message : "upload failed"}.`);
      }
    }
    if (checked.publish) {
      const res = await submitProduct(productId);
      if (!res.ok && !/Only draft or returned/.test(res.message)) warnings.push(`Kept as draft: ${res.message}`);
    }
    return warnings;
  }

  async function runImport() {
    setRunning(true);
    setDone(0);
    setRunError(null);
    const all: ImportUnitResult[] = [];
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      setRunError("Your session expired. Sign in again, then import.");
      setRunning(false);
      return;
    }
    for (let i = 0; i < ready.length; i += IMPORT_CHUNK_SIZE) {
      const chunk = ready.slice(i, i + IMPORT_CHUNK_SIZE);
      try {
        const res = await importProductsChunk(chunk.map((p) => p.unit), mode);
        if ("error" in res) {
          setRunError(res.error);
          break;
        }
        for (const result of res.results) {
          const item = chunk.find((p) => p.unit.lines[0] === result.lines[0]);
          if (result.status !== "failed" && result.productId && item) {
            const warnings = await finishProduct(supabase, auth.user.id, result.productId, item.checked);
            if (warnings.length) result.message = [result.message, ...warnings].filter(Boolean).join(" ");
          }
          all.push(result);
        }
      } catch {
        // Network or server failure: mark this chunk failed and keep going.
        all.push(...chunk.map((p) => ({ lines: p.unit.lines, status: "failed" as const, message: "Network error. Try again." })));
      }
      setDone(Math.min(i + IMPORT_CHUNK_SIZE, ready.length));
    }
    setResults(all);
    setRunning(false);
  }

  const counts = results && {
    created: results.filter((r) => r.status === "created").length,
    updated: results.filter((r) => r.status === "updated").length,
    failed: results.filter((r) => r.status === "failed").length + withProblems,
    warnings: results.filter((r) => r.status !== "failed" && r.message).length,
  };

  function downloadFailed() {
    const lineRow = new Map<number, ImportRow>();
    rows.forEach((row, i) => lineRow.set(i + 2, row));
    const out: string[][] = [[...IMPORT_COLUMNS, "error"]];
    const add = (lines: number[], message: string) =>
      lines.forEach((l) => out.push([...IMPORT_COLUMNS.map((c) => lineRow.get(l)?.[c] ?? ""), message]));
    planned.filter((p) => p.problem).forEach((p) => add(p.unit.lines, p.problem!));
    (results ?? []).filter((r) => r.status === "failed" || r.message).forEach((r) => add(r.lines, r.message ?? "Failed."));
    downloadCsv("products-to-fix.csv", toCsv(out));
  }

  /** Image files named by SKU (SKU_1.jpg …) → uploaded straight to Storage, then attached. */
  async function onImages(files: File[]) {
    if (files.length === 0) return;
    void warnIfLowRes(files);
    setImageBusy(true);
    setImageStatus("Matching files to SKUs…");
    try {
      const { bySku, unmatched } = groupImagesBySku(files);
      const products = await findProductsBySku([...bySku.keys()]);
      const supabase = createClient();
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Your session expired. Sign in again.");

      let attached = 0;
      const problems: string[] = [];
      const unknown = [...bySku.keys()].filter((sku) => !products[sku]);
      let n = 0;
      for (const [sku, skuFiles] of bySku) {
        const productId = products[sku];
        if (!productId) continue;
        setImageStatus(`Uploading images for ${sku} (${++n} of ${bySku.size - unknown.length})…`);
        try {
          const images = await uploadLocal(supabase, auth.user.id, productId, skuFiles.slice(0, MAX_PRODUCT_IMAGES));
          const res = await attachUploadedImages(productId, { images });
          if (!res.ok) {
            await supabase.storage.from("product_images").remove(images);
            throw new Error(res.message);
          }
          attached += 1;
        } catch (err) {
          problems.push(`${sku}: ${err instanceof Error ? err.message : "upload failed"}`);
        }
      }
      setImageStatus(
        [
          `Images added to ${plural(attached, "product")}.`,
          unknown.length ? `No product with SKU: ${unknown.join(", ")}.` : "",
          unmatched.length ? `Skipped (name must be SKU_1.jpg etc.): ${unmatched.join(", ")}.` : "",
          problems.length ? `Failed: ${problems.join("; ")}.` : "",
        ].filter(Boolean).join(" "),
      );
    } catch (err) {
      setImageStatus(err instanceof Error ? err.message : "Could not add images.");
    } finally {
      setImageBusy(false);
      if (imagesRef.current) imagesRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>1. Get the template</CardTitle>
          <CardDescription>
            One product per row, with the same fields as Add product. Required: <b>title</b>, <b>category</b>,{" "}
            <b>description</b> (50+ characters) and <b>price</b>. Yes/no columns: negotiable, winning_product,
            hot_selling, publish. For sizes or colours, give the rows the same <b>variant_group</b>. In{" "}
            <b>images</b>, put web links or photos on your computer (<code>C:\Photos\shirt.jpg</code> or just{" "}
            <code>shirt.jpg</code>), separated by <code>|</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => downloadCsv("products-template.csv", templateCsv())}>
            <HugeiconsIcon icon={Download01Icon} strokeWidth={2} />
            Download template
          </Button>
          <Button variant="outline" render={<a href="/supplier/dashboard/products/export" />} nativeButton={false}>
            <HugeiconsIcon icon={Download01Icon} strokeWidth={2} />
            Export my products
          </Button>
        </CardContent>
        <CardContent>
          <FieldDescription>
            Export, change prices or stock in Excel, then import it back with &quot;Update it&quot; below.
          </FieldDescription>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Upload and check</CardTitle>
          <CardDescription>.xlsx or .csv. Nothing is saved until you press Import; every row is checked first.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field>
              <FieldLabel htmlFor="import-file">Spreadsheet</FieldLabel>
              <input
                ref={fileRef}
                id="import-file"
                type="file"
                accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="sr-only"
                onChange={(e) => onFile(e.target.files?.[0] ?? null)}
              />
              <Button variant="outline" disabled={running} onClick={() => fileRef.current?.click()}>
                <HugeiconsIcon icon={Upload01Icon} strokeWidth={2} />
                <span className="truncate">{fileName ?? "Choose file"}</span>
              </Button>
            </Field>
            <Field>
              <FieldLabel>Photos on your computer</FieldLabel>
              {/* Browsers can't open a path typed in a sheet: the supplier picks the folder once. */}
              <input
                ref={folderRef}
                type="file"
                multiple
                className="sr-only"
                {...{ webkitdirectory: "", directory: "" }}
                onChange={(e) => {
                  onLocalPhotos([...(e.target.files ?? [])]);
                  e.target.value = "";
                }}
              />
              <input
                ref={photosRef}
                type="file"
                multiple
                accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(e) => {
                  onLocalPhotos([...(e.target.files ?? [])]);
                  e.target.value = "";
                }}
              />
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" disabled={running} onClick={() => folderRef.current?.click()}>
                  <HugeiconsIcon icon={Folder01Icon} strokeWidth={2} />
                  Folder
                </Button>
                <Button variant="outline" className="flex-1" disabled={running} onClick={() => photosRef.current?.click()}>
                  <HugeiconsIcon icon={Image01Icon} strokeWidth={2} />
                  Files
                </Button>
              </div>
              <FieldDescription>
                {localFiles.size > 0
                  ? `${plural(localFiles.size, "photo")} selected.`
                  : "Only needed if the sheet names photos on your computer."}
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="import-mode">When a SKU already exists</FieldLabel>
              <NativeSelect
                id="import-mode"
                value={mode}
                disabled={running}
                onChange={(e) => setMode(e.target.value as ImportMode)}
              >
                <NativeSelectOption value="create">Skip it (create new products only)</NativeSelectOption>
                <NativeSelectOption value="upsert">Update it (create or update by SKU)</NativeSelectOption>
              </NativeSelect>
            </Field>
          </div>
          {mode === "upsert" ? (
            <FieldDescription>
              Updating replaces the product&apos;s details; its images and variants only if the file has them.
            </FieldDescription>
          ) : null}

          {fileError ? (
            <Alert variant="destructive">
              <AlertTitle>Can&apos;t read this file</AlertTitle>
              <AlertDescription>{fileError}</AlertDescription>
            </Alert>
          ) : null}

          {table && !results ? (
            <details open={missing.length > 0} className="rounded-lg border border-border p-3">
              <summary className="cursor-pointer text-sm font-medium">
                Match your columns{" "}
                {missing.length > 0 ? (
                  <span className="text-destructive">— pick a column for: {missing.map((c) => COLUMN_LABELS[c]).join(", ")}</span>
                ) : (
                  <span className="text-muted-foreground">— matched automatically</span>
                )}
              </summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {table[0].map((header, i) => (
                  <Field key={i}>
                    <FieldLabel htmlFor={`map-${i}`} className="truncate">
                      {header || `Column ${i + 1}`}
                    </FieldLabel>
                    <NativeSelect
                      id={`map-${i}`}
                      value={mapping[i] ?? ""}
                      disabled={running}
                      onChange={(e) => {
                        const value = e.target.value as ImportColumn | "";
                        // One sheet column per field: picking a field frees it elsewhere.
                        setMapping((m) => m.map((c, j) => (j === i ? value : c === value && value ? "" : c)));
                      }}
                    >
                      <NativeSelectOption value="">Don&apos;t import</NativeSelectOption>
                      {IMPORT_COLUMNS.map((c) => (
                        <NativeSelectOption key={c} value={c}>
                          {COLUMN_LABELS[c]}
                        </NativeSelectOption>
                      ))}
                    </NativeSelect>
                  </Field>
                ))}
              </div>
            </details>
          ) : null}

          {planned.length > 0 && !results ? (
            <>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant="success">{ready.length} ready</Badge>
                {withProblems > 0 ? <Badge variant="destructive">{withProblems} need fixing</Badge> : null}
                <span className="text-muted-foreground">
                  {plural(planned.length, "product")} from {plural(rows.length, "row")}.
                  {withProblems > 0 ? " Products that need fixing are skipped." : ""}
                </span>
              </div>
              {needsPhotos ? (
                <Alert>
                  <AlertTitle>Select your photos</AlertTitle>
                  <AlertDescription>
                    The sheet names photos on your computer. Use <b>Folder</b> (or <b>Files</b>) above to select them;
                    they&apos;re matched by file name.
                  </AlertDescription>
                </Alert>
              ) : null}
              <div className="max-h-[28rem] overflow-auto rounded-lg border border-border">
                <Table className="min-w-[640px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Row</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead>Check</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {planned.map(({ unit, checked, problem }) => {
                      const first = unit.rows[0];
                      return (
                        <TableRow key={unit.lines[0]}>
                          <TableCell className="tabular-nums text-muted-foreground">{rowsLabel(unit.lines)}</TableCell>
                          <TableCell className="max-w-64">
                            <span className="line-clamp-1 font-medium">{first.title || "—"}</span>
                            <span className="text-xs text-muted-foreground">
                              {first.variant_group
                                ? `${first.variant_group} · ${plural(unit.rows.length, "variant")}`
                                : first.sku}
                            </span>
                          </TableCell>
                          <TableCell className="max-w-40 truncate">{first.category || "—"}</TableCell>
                          <TableCell className="text-right tabular-nums">{first.price || "—"}</TableCell>
                          <TableCell className="max-w-72">
                            {problem ? (
                              <span className="text-sm text-destructive">{problem}</span>
                            ) : (
                              <span className="text-sm text-success">
                                Ready
                                {checked ? ` · ${plural(checked.images.length, "image")}` : ""}
                                {checked?.publish ? " · publish" : " · draft"}
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              {running ? (
                <div className="flex flex-col gap-1.5">
                  <Progress value={ready.length ? (done / ready.length) * 100 : 0} />
                  <p className="text-sm text-muted-foreground tabular-nums">
                    Importing {done} of {ready.length}… keep this page open.
                  </p>
                </div>
              ) : (
                <div>
                  <Button disabled={ready.length === 0} onClick={runImport}>
                    Import {plural(ready.length, "product")}
                  </Button>
                </div>
              )}
            </>
          ) : null}

          {runError ? (
            <Alert variant="destructive">
              <AlertTitle>Import stopped</AlertTitle>
              <AlertDescription>{runError}</AlertDescription>
            </Alert>
          ) : null}

          {counts ? (
            <Alert>
              <AlertTitle>Import finished</AlertTitle>
              <AlertDescription>
                {counts.created} created, {counts.updated} updated, {counts.failed} failed
                {counts.warnings ? `, ${counts.warnings} saved with a warning` : ""}.
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" render={<Link href="/supplier/dashboard/products" />} nativeButton={false}>
                    View products
                  </Button>
                  {counts.failed + counts.warnings > 0 ? (
                    <Button size="sm" variant="outline" onClick={downloadFailed}>
                      <HugeiconsIcon icon={Download01Icon} strokeWidth={2} />
                      Download rows to fix
                    </Button>
                  ) : null}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (fileRef.current) fileRef.current.value = "";
                      setFileName(null);
                      reset();
                    }}
                  >
                    Import another file
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>3. Add images by file name (optional)</CardTitle>
          <CardDescription>
            For products that already exist: name each photo after the SKU, like <code>CABLE-ORG-01_1.jpg</code>,{" "}
            <code>CABLE-ORG-01_2.jpg</code> (up to {MAX_PRODUCT_IMAGES} per product; replaces its current images).
            Have a ZIP? Unzip it and select the files.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <input
            ref={imagesRef}
            type="file"
            multiple
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => onImages([...(e.target.files ?? [])])}
          />
          <div>
            <Button variant="outline" disabled={imageBusy || running} onClick={() => imagesRef.current?.click()}>
              <HugeiconsIcon icon={Image01Icon} strokeWidth={2} />
              {imageBusy ? "Adding images…" : "Choose image files"}
            </Button>
          </div>
          {imageStatus ? <p className="text-sm text-muted-foreground">{imageStatus}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
