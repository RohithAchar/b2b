"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { Upload01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { importCustomers, type ImportActionState } from "@/lib/supplier/customer-actions";

const initialState: ImportActionState = { ok: false, message: "" };

/** CSV bulk import with a result summary (imported / duplicates / invalid). */
export function CustomerImportDialog() {
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [state, action, pending] = useActionState(importCustomers, initialState);
  const [submitted, setSubmitted] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (submitted && !pending && state.ok) {
      router.refresh();
    }
  }, [submitted, pending, state.ok, router]);

  const result = submitted && !pending && (state.imported !== undefined || state.message) ? state : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setSubmitted(false);
          setFileName(null);
          formRef.current?.reset();
        }
      }}
    >
      <DialogTrigger
        render={
          <Button variant="outline">
            <HugeiconsIcon icon={Upload01Icon} strokeWidth={2} data-icon="inline-start" />
            Import
          </Button>
        }
      />
      <DialogContent showCloseButton>
        <DialogHeader>
          <DialogTitle>Import customers</DialogTitle>
          <DialogDescription>
            CSV with name, mobile number, email and city columns. A header row is
            optional — without one, columns are read in that order.
          </DialogDescription>
        </DialogHeader>
        <form
          ref={formRef}
          action={action}
          onSubmit={() => setSubmitted(true)}
        >
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="customer-csv">CSV file</FieldLabel>
              <Input
                id="customer-csv"
                name="file"
                type="file"
                accept=".csv,text/csv"
                required
                onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
              />
              <FieldDescription>
                {fileName ?? "512 KB max. Exact phone/email matches are skipped as duplicates."}
              </FieldDescription>
            </Field>
            {result ? (
              <div role={result.ok ? "status" : "alert"} className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
                {result.ok ? (
                  <p>
                    Imported <strong className="tabular-nums">{result.imported ?? 0}</strong>
                    {result.skippedDuplicates ? (
                      <>, skipped <strong className="tabular-nums">{result.skippedDuplicates}</strong> duplicates</>
                    ) : null}
                    {result.invalid && result.invalid.length > 0 ? (
                      <>, {result.invalid.length} invalid row{result.invalid.length === 1 ? "" : "s"} (row {result.invalid.slice(0, 5).map((r) => r.row).join(", ")}{result.invalid.length > 5 ? "…" : ""})</>
                    ) : null}
                    .
                  </p>
                ) : (
                  <p className="text-destructive">{result.message}</p>
                )}
              </div>
            ) : null}
            <Button type="submit" disabled={pending}>
              {pending ? (
                <>
                  <Spinner data-icon="inline-start" />
                  Importing…
                </>
              ) : (
                "Import customers"
              )}
            </Button>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  );
}
