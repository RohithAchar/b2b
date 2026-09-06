import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/server";
import { DecisionForm } from "./decision-form";

const STATUS_BADGE: Record<
  string,
  { label: string; variant: "secondary" | "default" | "destructive" | "outline" }
> = {
  draft: { label: "Not submitted", variant: "outline" },
  pending: { label: "Waiting for review", variant: "secondary" },
  verified: { label: "Approved", variant: "default" },
  rejected: { label: "Needs changes", variant: "destructive" },
};

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value || "—"}</span>
    </div>
  );
}

function SectionTitle({ index, title }: { index: string; title: string }) {
  return (
    <h2 className="text-base font-medium">
      <span className="mr-2 text-muted-foreground">{index}</span>
      {title}
    </h2>
  );
}

function DocPreview({ url, path }: { url: string | null; path: string | null }) {
  if (!url) {
    return <span className="text-sm text-muted-foreground">Not uploaded</span>;
  }
  const lower = (path ?? "").toLowerCase();
  if (lower.endsWith(".pdf")) {
    return (
      <iframe
        src={url}
        title="Document preview"
        className="h-96 w-full rounded-xl border border-border"
      />
    );
  }
  if (
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".png")
  ) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt="Document preview"
        className="max-h-96 w-full rounded-xl border border-border object-contain"
      />
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-sm text-primary underline underline-offset-4"
    >
      Open document
    </a>
  );
}

type ReviewPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminReviewPage({ params }: ReviewPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: company } = await supabase
    .from("companies")
    .select(
      "id, business_name, contact_person, phone, address, city, state, pincode, gstin, pan, bank_account, bank_ifsc, gst_certificate_path, pan_card_path, license_path, logo_path, kyb_status, rejection_note, submitted_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (!company) {
    notFound();
  }

  const status = STATUS_BADGE[company.kyb_status] ?? {
    label: company.kyb_status,
    variant: "outline" as const,
  };

  const docs = [
    { label: "GST certificate", path: company.gst_certificate_path, against: company.gstin },
    { label: "PAN card", path: company.pan_card_path, against: company.pan },
    { label: "Business license", path: company.license_path, against: company.business_name },
  ];

  const signedUrls: Record<string, string> = {};
  for (const doc of docs) {
    if (doc.path) {
      const { data } = await supabase.storage
        .from("company_docs")
        .createSignedUrl(doc.path, 600);
      if (data?.signedUrl) {
        signedUrls[doc.label] = data.signedUrl;
      }
    }
  }

  const decidable =
    company.kyb_status === "pending" || company.kyb_status === "rejected";

  return (
    <div className="mx-auto w-full max-w-5xl p-6">
      <Button
        render={<Link href="/admin/dashboard/supplier-verification" />}
        nativeButton={false}
        variant="ghost"
        className="mb-4"
      >
        ← Back to queue
      </Button>
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              {company.logo_path ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/company_logos/${company.logo_path}`}
                  alt=""
                  className="size-12 rounded-2xl border border-border object-cover"
                />
              ) : null}
              <div className="flex min-w-0 flex-col gap-1">
                <CardTitle>{company.business_name}</CardTitle>
                <CardDescription>
                  {company.contact_person} — {company.phone}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div className="flex flex-col gap-4">
              <SectionTitle index="1" title="Business" />
              <div className="grid grid-cols-2 gap-4">
                <Field label="Contact person" value={company.contact_person} />
                <Field label="Mobile" value={company.phone} />
              </div>
              <Field
                label="Registered address"
                value={
                  company.address
                    ? `${company.address}, ${company.city}, ${company.state} ${company.pincode}`
                    : null
                }
              />
            </div>
            <Separator />
            <div className="flex flex-col gap-4">
              <SectionTitle index="2" title="Tax IDs" />
              <div className="grid grid-cols-2 gap-4">
                <Field label="GSTIN" value={company.gstin} />
                <Field label="PAN" value={company.pan} />
              </div>
            </div>
            <Separator />
            <div className="flex flex-col gap-4">
              <SectionTitle index="3" title="Bank" />
              <div className="grid grid-cols-2 gap-4">
                <Field label="Account number" value={company.bank_account} />
                <Field label="IFSC" value={company.bank_ifsc} />
              </div>
            </div>
            <Separator />
            <div className="flex flex-col gap-4">
              <SectionTitle index="4" title="Documents" />
              {docs.map((doc) => (
                <div key={doc.label} className="flex flex-col gap-2">
                  <Label>
                    {doc.label}
                    <span className="ml-2 text-xs text-muted-foreground">
                      filed as {doc.against || "—"}
                    </span>
                  </Label>
                  <DocPreview url={signedUrls[doc.label] ?? null} path={doc.path} />
                  {signedUrls[doc.label] ? (
                    <a
                      href={signedUrls[doc.label]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary underline underline-offset-4"
                    >
                      Open in new tab to zoom
                    </a>
                  ) : null}
                </div>
              ))}
            </div>
            {company.kyb_status === "rejected" && company.rejection_note ? (
              <div className="flex flex-col gap-1 rounded-xl border border-destructive/40 bg-destructive/10 p-4">
                <Label>Previous note to supplier</Label>
                <p className="text-sm">{company.rejection_note}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <div className="lg:sticky lg:top-6 lg:self-start">
          <Card>
            <CardHeader>
              <Badge variant={status.variant}>{status.label}</Badge>
              <CardDescription>
                Submitted{" "}
                {company.submitted_at
                  ? new Date(company.submitted_at).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : "—"}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {decidable ? (
                <DecisionForm id={company.id} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Already decided — no action needed.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
