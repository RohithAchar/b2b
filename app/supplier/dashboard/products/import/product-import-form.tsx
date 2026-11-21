"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Download01Icon,
  Upload01Icon,
} from "@hugeicons/core-free-icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Progress,
  ProgressLabel,
  ProgressValue,
} from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  PRODUCT_IMPORT_MAX_BYTES,
  PRODUCT_IMPORT_MAX_PHOTOS,
  PRODUCT_IMPORT_MAX_ROWS,
  PRODUCT_IMPORT_UNITS_LABEL,
  PRODUCT_IMPORT_WRITE_BATCH_SIZE,
  PRODUCT_IMPORT_XLSX_MAX_BYTES,
  buildProductImportTemplate,
  csvCell,
  groupImportImages,
  type ImportCategory,
  type ProductImportImageEntry,
  type ProductImportPreview,
  type ProductImportPreviewRow,
  type ProductImportRawRow,
} from "@/lib/supplier/product-import-sheet";
import { MIN_PRODUCT_IMAGES } from "@/lib/supplier/products";
import {
  finishProductImport,
  importProductBatch,
  importProductImages,
  previewProductImportFile,
} from "@/lib/supplier/product-import-sheet-actions";
import { findLowResImages, lowResWarning } from "@/lib/shrink-image";
import { toast } from "@/components/ui/toast";

/** Advise (never block) when photos in the SKU folders are too small to look sharp. */
async function warnIfLowRes(files: File[]) {
  const images = files.filter((f) => /\.(jpe?g|png|webp)$/i.test(f.name));
  const warning = lowResWarning(await findLowResImages(images));
  if (warning) toast.add({ type: "warning", ...warning });
}

const PRODUCTS_PATH = "/supplier/dashboard/products";
const TEMPLATE_ROUTE = "/api/supplier/products/import/template";
const TEMPLATE_FILE = "d2b-product-import-template.csv";
const REPORT_FILE = "d2b-product-import-report.csv";

type Phase = "idle" | "checking" | "ready" | "importing" | "done";
type CreatedRow = {
  line: number;
  title: string;
  sku: string;
  productId: string;
  warnings: string[];
};
type FailedRow = { line: number; title: string; message: string };
type SelectedImage = {
  file: File;
  relativePath: string;
  size: number;
  type: string;
};

const STATUS_BADGE: Record<
  ProductImportPreviewRow["status"],
  { label: string; variant: "success" | "destructive" | "warning" }
> = {
  ready: { label: "Ready", variant: "success" },
  error: { label: "Fix row", variant: "destructive" },
  duplicate: { label: "Duplicate", variant: "warning" },
};

function downloadCsv(fileName: string, contents: string) {
  const blob = new Blob([contents], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function rowTitle(row: ProductImportRawRow): string {
  return (row.cells.title ?? "").trim() || "(untitled row)";
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ProductImportForm({
  categories,
  storeId,
}: {
  categories: ImportCategory[];
  storeId?: string;
}) {
  const router = useRouter();
  const excelInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const previewSeq = useRef(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [folderFiles, setFolderFiles] = useState<File[]>([]);
  const [rows, setRows] = useState<ProductImportRawRow[]>([]);
  const [preview, setPreview] = useState<ProductImportPreview | null>(null);
  const [publish, setPublish] = useState(true);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [created, setCreated] = useState<CreatedRow[]>([]);
  const [failed, setFailed] = useState<FailedRow[]>([]);
  const [published, setPublished] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const busy = phase === "checking" || phase === "importing";
  const importing = phase === "importing";
  const imported = phase === "done";
  const readyRows = useMemo(
    () => (preview?.ok ? preview.rows.filter((row) => row.status === "ready") : []),
    [preview],
  );
  const blockingCount = preview?.ok
    ? preview.summary.errors + preview.summary.duplicates
    : 0;
  const warnings = created.reduce((total, row) => total + row.warnings.length, 0);
  const percent =
    progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0;

  const selectedImages = useMemo<SelectedImage[]>(
    () =>
      folderFiles.map((file) => ({
        file,
        relativePath: file.webkitRelativePath || file.name,
        size: file.size,
        type: file.type,
      })),
    [folderFiles],
  );

  // Same grouping and ordering the server uses, so the files uploaded for each
  // product match the preview exactly.
  const imageGroups = useMemo(() => groupImportImages(selectedImages), [selectedImages]);
  const filesBySku = useMemo(
    () =>
      new Map(
        imageGroups.folders.map((folder) => [
          folder.sku,
          folder.files.map((entry) => entry.file),
        ]),
      ),
    [imageGroups],
  );
  const photoCount = imageGroups.folders.reduce(
    (total, folder) => total + folder.files.length,
    0,
  );
  const folderName = folderFiles[0]?.webkitRelativePath.split("/")[0] ?? null;

  // Leaving mid-import would silently drop the remaining batches.
  useEffect(() => {
    if (!importing) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [importing]);

  function resetInputs() {
    if (excelInputRef.current) excelInputRef.current.value = "";
    if (folderInputRef.current) folderInputRef.current.value = "";
  }

  function resetImport() {
    setPhase("idle");
    setExcelFile(null);
    setFolderFiles([]);
    setRows([]);
    setPreview(null);
    setProgress({ done: 0, total: 0 });
    setCreated([]);
    setFailed([]);
    setPublished(0);
    setError(null);
    resetInputs();
  }

  async function refreshPreview(file: File | null, files: File[]) {
    if (!file) {
      setPhase("idle");
      setPreview(null);
      setRows([]);
      return;
    }

    const seq = ++previewSeq.current;
    setPhase("checking");
    setError(null);
    setCreated([]);
    setFailed([]);
    setPublished(0);
    setProgress({ done: 0, total: 0 });

    const formData = new FormData();
    formData.append("file", file);
    const manifest: ProductImportImageEntry[] = files.map((entry) => ({
      relativePath: entry.webkitRelativePath || entry.name,
      size: entry.size,
      type: entry.type,
    }));

    try {
      const result = await previewProductImportFile(formData, manifest);
      if (seq !== previewSeq.current) return;
      if (!result.ok) {
        setPhase("idle");
        setPreview(null);
        setRows([]);
        setError(result.message);
        return;
      }
      setRows(result.rows);
      setPreview(result.preview);
      setPhase("ready");
    } catch {
      if (seq !== previewSeq.current) return;
      setPhase("idle");
      setPreview(null);
      setRows([]);
      setError("The file could not be read or checked. Try again.");
    }
  }

  function handleWorkbook(file: File | undefined) {
    if (!file) return;

    const isXlsx = /\.xlsx$/i.test(file.name);
    const isCsv = /\.csv$/i.test(file.name);
    if (!isXlsx && !isCsv) {
      setPhase("idle");
      setExcelFile(null);
      setPreview(null);
      setRows([]);
      if (excelInputRef.current) excelInputRef.current.value = "";
      setError("Use an Excel (.xlsx) or CSV (.csv) file.");
      return;
    }

    const maxBytes = isXlsx ? PRODUCT_IMPORT_XLSX_MAX_BYTES : PRODUCT_IMPORT_MAX_BYTES;
    if (file.size > maxBytes) {
      setPhase("idle");
      setExcelFile(null);
      setPreview(null);
      setRows([]);
      if (excelInputRef.current) excelInputRef.current.value = "";
      setError(
        `That file is ${formatBytes(file.size)}. ${isXlsx ? "Excel" : "CSV"} files can be up to ${formatBytes(maxBytes)}.`,
      );
      return;
    }

    setExcelFile(file);
    // Clearing the native value lets the same file be chosen again after a fix.
    if (excelInputRef.current) excelInputRef.current.value = "";
    void refreshPreview(file, folderFiles);
  }

  function handleFolder(list: FileList | null) {
    const files = Array.from(list ?? []);
    setFolderFiles(files);
    void warnIfLowRes(files);
    // Same for the folder: re-selecting it must always re-run the check.
    if (folderInputRef.current) folderInputRef.current.value = "";
    void refreshPreview(excelFile, files);
  }

  async function runImport() {
    if (!preview?.ok || blockingCount > 0) return;
    const readyLines = new Set(readyRows.map((row) => row.line));
    const importable = rows.filter((row) => readyLines.has(row.line));
    if (importable.length === 0) return;

    setPhase("importing");
    setError(null);
    setCreated([]);
    setFailed([]);
    setPublished(0);
    setProgress({ done: 0, total: importable.length });

    const allCreated: CreatedRow[] = [];
    const allFailed: FailedRow[] = [];
    let processed = 0;
    let publishedTotal = 0;

    for (let start = 0; start < importable.length; start += PRODUCT_IMPORT_WRITE_BATCH_SIZE) {
      const batch = importable.slice(start, start + PRODUCT_IMPORT_WRITE_BATCH_SIZE);

      let result: Awaited<ReturnType<typeof importProductBatch>>;
      try {
        result = await importProductBatch(batch, { storeId });
      } catch {
        result = {
          ok: false,
          message: "The connection dropped before this batch finished.",
        };
      }

      if (!result.ok) {
        // This batch and everything after it was not written.
        for (const row of importable.slice(start)) {
          allFailed.push({
            line: row.line,
            title: rowTitle(row),
            message: `Not imported. ${result.message}`,
          });
        }
        processed = importable.length;
        setFailed([...allFailed]);
        setProgress({ done: processed, total: importable.length });
        break;
      }

      allFailed.push(...result.failed);

      for (const product of result.created) {
        const files = filesBySku.get(product.sku.toUpperCase()) ?? [];
        if (files.length > 0) {
          const formData = new FormData();
          formData.append("product_id", product.productId);
          formData.append("publish", publish ? "true" : "false");
          for (const file of files) formData.append("images", file, file.name);

          try {
            const images = await importProductImages(formData);
            if (images.ok) {
              publishedTotal += images.published ? 1 : 0;
              product.warnings.push(...images.warnings);
            } else {
              product.warnings.push(`Photos were not added: ${images.message}`);
            }
          } catch {
            product.warnings.push(
              "Photos were not added: the connection dropped. Add them from the product page.",
            );
          }
        }

        allCreated.push(product);
        processed += 1;
        setCreated([...allCreated]);
        setFailed([...allFailed]);
        setPublished(publishedTotal);
        setProgress({ done: processed, total: importable.length });
      }

      if (result.failed.length > 0) {
        processed = Math.min(processed + result.failed.length, importable.length);
        setFailed([...allFailed]);
        setProgress({ done: processed, total: importable.length });
      }
    }

    try {
      await finishProductImport(publishedTotal);
    } catch {
      // Cache refresh is best-effort; the products are already saved.
    }
    setPhase("done");
    router.refresh();
  }

  function downloadTemplate() {
    downloadCsv(TEMPLATE_FILE, buildProductImportTemplate(categories));
  }

  function downloadReport() {
    const skuByLine = new Map(
      rows.map((row) => [row.line, (row.cells.seller_sku ?? "").trim().toUpperCase()]),
    );
    const lines = [
      ["Line", "Product title", "Seller SKU", "Status", "Details"]
        .map(csvCell)
        .join(","),
    ];
    for (const row of created) {
      lines.push(
        [
          String(row.line),
          row.title,
          row.sku || skuByLine.get(row.line) || "",
          row.warnings.length > 0 ? "Imported with warnings" : "Imported",
          row.warnings.join(" "),
        ]
          .map(csvCell)
          .join(","),
      );
    }
    for (const row of failed) {
      lines.push(
        [
          String(row.line),
          row.title,
          skuByLine.get(row.line) ?? "",
          "Not imported",
          row.message,
        ]
          .map(csvCell)
          .join(","),
      );
    }
    downloadCsv(REPORT_FILE, `${lines.join("\r\n")}\r\n`);
  }

  return (
    <div className="flex w-full flex-col gap-4">
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Check the file</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {!imported ? (
        <Card>
          <CardHeader>
            <CardTitle>1. Choose the Excel file and photos</CardTitle>
            <CardDescription>
              Download the Excel template for dropdowns and checks. CSV files
              still work. The photos folder is optional, but needed to import
              photos.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                render={<a href={TEMPLATE_ROUTE} download />}
                nativeButton={false}
              >
                <HugeiconsIcon icon={Download01Icon} strokeWidth={2} />
                Download Excel template
              </Button>
              <Button type="button" variant="ghost" onClick={downloadTemplate}>
                Download CSV template
              </Button>
              {categories.length > 0 ? (
                <p className="self-center text-xs text-muted-foreground">
                  {categories.length} categor{categories.length === 1 ? "y" : "ies"}{" "}
                  available in the dropdown.
                </p>
              ) : null}
            </div>

            <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
              <p className="font-medium">Photos: one folder per SKU</p>
              <p className="mt-1 text-muted-foreground">
                Create a folder named <code className="text-foreground">images</code>,
                then one subfolder for each Seller SKU. Name the photos{" "}
                <code className="text-foreground">1.jpg</code>,{" "}
                <code className="text-foreground">2.jpg</code>, and so on.
              </p>
              <pre className="mt-2 overflow-x-auto rounded-md bg-card px-3 py-2 text-xs text-foreground">
{`images/
  SKU-001/
    1.jpg
    2.jpg
    3.jpg
  SKU-002/
    1.jpg`}
              </pre>
              <p className="mt-2 text-muted-foreground">
                Up to {PRODUCT_IMPORT_MAX_PHOTOS} photos per SKU, each under 2 MB.
                Choose the Excel file and the{" "}
                <code className="text-foreground">images</code> folder below;
                photos are compressed when you import.
              </p>
            </div>

            <Field>
              <FieldLabel htmlFor="product-file">Excel or CSV file</FieldLabel>
              <Input
                id="product-file"
                ref={excelInputRef}
                type="file"
                accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                disabled={busy}
                onChange={(event) => handleWorkbook(event.target.files?.[0])}
              />
              <FieldDescription>
                {excelFile
                  ? `${excelFile.name} · ${rows.length} row${rows.length === 1 ? "" : "s"} read`
                  : `Up to ${PRODUCT_IMPORT_MAX_ROWS} rows. Excel up to ${formatBytes(PRODUCT_IMPORT_XLSX_MAX_BYTES)}, CSV up to ${formatBytes(PRODUCT_IMPORT_MAX_BYTES)}. Required columns: Product title, Category, Description, Price per unit. Units: ${PRODUCT_IMPORT_UNITS_LABEL}.`}
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="product-images">Photos folder</FieldLabel>
              <Input
                id="product-images"
                ref={folderInputRef}
                type="file"
                multiple
                disabled={busy}
                onChange={(event) => handleFolder(event.target.files)}
                {...{ webkitdirectory: "", directory: "" }}
              />
              <FieldDescription>
                {folderName
                  ? `${folderName} · ${photoCount} photo${photoCount === 1 ? "" : "s"} in ${imageGroups.folders.length} SKU folder${imageGroups.folders.length === 1 ? "" : "s"}`
                  : "Choose the images folder that contains the SKU subfolders. Leave it empty to import products without photos."}
              </FieldDescription>
            </Field>

            {phase === "checking" ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Spinner />
                Checking rows and photos…
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {preview?.ok && preview.imageNotes.length > 0 && !imported ? (
        <Alert>
          <AlertTitle>Photos that will be skipped</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-5">
              {preview.imageNotes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      {preview?.ok && blockingCount > 0 && !imported ? (
        <Alert variant="destructive">
          <AlertTitle>
            Fix {blockingCount} problem{blockingCount === 1 ? "" : "s"} before
            importing
          </AlertTitle>
          <AlertDescription>
            Nothing has been saved. Correct the highlighted rows in the Excel
            file and the photo folders above, then choose the files again.
          </AlertDescription>
        </Alert>
      ) : null}

      {preview?.ok && !imported ? (
        <Card className="!gap-0 !py-0">
          <CardHeader className="border-b border-border px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>2. Review</CardTitle>
                <CardDescription>
                  Nothing is saved yet. Every row and photo must be correct
                  before the import starts.
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="success">
                  {preview.summary.ready} ready
                </Badge>
                {preview.summary.errors > 0 ? (
                  <Badge variant="destructive">
                    {preview.summary.errors} to fix
                  </Badge>
                ) : null}
                {preview.summary.images > 0 ? (
                  <Badge variant="info">
                    {preview.summary.images} photo
                    {preview.summary.images === 1 ? "" : "s"}
                  </Badge>
                ) : null}
                {preview.summary.duplicates > 0 ? (
                  <Badge variant="warning">
                    {preview.summary.duplicates} duplicate
                    {preview.summary.duplicates === 1 ? "" : "s"}
                  </Badge>
                ) : null}
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 !px-0">
            <div className="max-h-[420px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16 pl-5">Line</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Photos</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="pr-5">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.rows.map((row) => {
                    const badge = STATUS_BADGE[row.status];
                    return (
                      <TableRow key={row.line}>
                        <TableCell className="pl-5 tabular-nums text-muted-foreground">
                          {row.line}
                        </TableCell>
                        <TableCell className="max-w-64 truncate" title={row.title}>
                          {row.title}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {row.sku || "—"}
                        </TableCell>
                        <TableCell className="tabular-nums text-muted-foreground">
                          {row.images || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                        </TableCell>
                        <TableCell className="max-w-md whitespace-normal pr-5 text-muted-foreground">
                          {row.message ? (
                            <span className="block whitespace-pre-line">
                              {row.message}
                            </span>
                          ) : null}
                          {row.warnings.map((warning) => (
                            <span key={warning} className="block text-warning">
                              {warning}
                            </span>
                          ))}
                          {!row.message && row.warnings.length === 0 ? "—" : null}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {importing || progress.total > 0 ? (
              <div className="border-t border-border px-5 py-4">
                <Progress value={percent}>
                  <ProgressLabel>
                    {importing
                      ? "Creating products and compressing photos…"
                      : "Import progress"}
                  </ProgressLabel>
                  <ProgressValue>
                    {() => `${progress.done} of ${progress.total}`}
                  </ProgressValue>
                </Progress>
              </div>
            ) : null}

            <div className="flex flex-col gap-4 border-t border-border px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="flex items-start gap-3">
                <Switch
                  id="publish-import"
                  checked={publish}
                  disabled={busy}
                  onCheckedChange={setPublish}
                />
                <div>
                  <label
                    htmlFor="publish-import"
                    className="text-sm font-medium"
                  >
                    Publish products with {MIN_PRODUCT_IMAGES} or more photos
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Products with fewer photos stay as drafts you can finish
                    later.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                disabled={readyRows.length === 0 || busy || blockingCount > 0}
                onClick={() => void runImport()}
              >
                {importing ? (
                  <>
                    <Spinner data-icon="inline-start" />
                    Importing…
                  </>
                ) : blockingCount > 0 ? (
                  <>
                    Fix {blockingCount} problem
                    {blockingCount === 1 ? "" : "s"} to import
                  </>
                ) : (
                  <>
                    <HugeiconsIcon icon={Upload01Icon} strokeWidth={2} />
                    Import {readyRows.length} product
                    {readyRows.length === 1 ? "" : "s"}
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {imported ? (
        <Card>
          <CardHeader>
            <CardTitle>Import results</CardTitle>
            <CardDescription>
              Created {created.length} of {progress.total} ready product
              {progress.total === 1 ? "" : "s"}
              {published > 0 ? `, ${published} published` : ""}.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="success">{created.length} created</Badge>
              {published > 0 ? (
                <Badge variant="info">{published} published</Badge>
              ) : null}
              {failed.length > 0 ? (
                <Badge variant="destructive">{failed.length} not imported</Badge>
              ) : null}
              {warnings > 0 ? (
                <Badge variant="warning">
                  {warnings} warning{warnings === 1 ? "" : "s"}
                </Badge>
              ) : null}
            </div>

            {failed.length > 0 ? (
              <div className="overflow-hidden rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Line</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Reason</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {failed.map((row) => (
                      <TableRow key={`${row.line}-${row.message}`}>
                        <TableCell className="tabular-nums text-muted-foreground">
                          {row.line}
                        </TableCell>
                        <TableCell className="max-w-64 truncate" title={row.title}>
                          {row.title}
                        </TableCell>
                        <TableCell className="whitespace-normal text-muted-foreground">
                          {row.message}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Every checked row was imported.
              </p>
            )}

            {warnings > 0 ? (
              <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
                <p className="font-medium">Warnings</p>
                <ul className="mt-1 flex list-disc flex-col gap-1 pl-5 text-muted-foreground">
                  {created.flatMap((row) =>
                    row.warnings.map((warning) => (
                      <li key={`${row.line}-${warning}`}>
                        Row {row.line}: {warning}
                      </li>
                    )),
                  )}
                </ul>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button
                render={<Link href={PRODUCTS_PATH} />}
                nativeButton={false}
              >
                View products
              </Button>
              <Button type="button" variant="outline" onClick={downloadReport}>
                <HugeiconsIcon icon={Download01Icon} strokeWidth={2} />
                Download report
              </Button>
              <Button type="button" variant="ghost" onClick={resetImport}>
                Import another file
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
