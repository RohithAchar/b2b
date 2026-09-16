import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyTitle } from "@/components/ui/empty";
import { FieldLegend, FieldSet } from "@/components/ui/field";
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item";
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

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <Item variant="outline" size="sm">
      <ItemContent>
        <ItemTitle>{value || "—"}</ItemTitle>
        <ItemDescription>{label}</ItemDescription>
      </ItemContent>
    </Item>
  );
}

function DocPreview({ url, path }: { url: string | null; path: string | null }) {
  if (!url) {
    return (
      <Empty>
        <EmptyTitle>Not uploaded</EmptyTitle>
        <EmptyDescription>This document was not provided.</EmptyDescription>
      </Empty>
    );
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
    <Button render={<a href={url} target="_blank" rel="noopener noreferrer" />} nativeButton={false} variant="outline">
      Open document
    </Button>
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
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink
              render={<Link href="/admin/dashboard/supplier-verification" />}
            >
              Supplier applications
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{company.business_name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader>
            <CardTitle>{company.business_name}</CardTitle>
            <CardDescription>
              {company.contact_person} — {company.phone}
            </CardDescription>
            {company.logo_path ? (
              <CardAction>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/company_logos/${company.logo_path}`}
                  alt=""
                  className="size-12 rounded-lg border border-border object-cover"
                />
              </CardAction>
            ) : null}
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <FieldSet>
              <FieldLegend>1 — Business</FieldLegend>
              <ItemGroup>
                <Detail label="Contact person" value={company.contact_person} />
                <Detail label="Mobile" value={company.phone} />
                <Detail
                  label="Registered address"
                  value={
                    company.address
                      ? `${company.address}, ${company.city}, ${company.state} ${company.pincode}`
                      : null
                  }
                />
              </ItemGroup>
            </FieldSet>
            <Separator />
            <FieldSet>
              <FieldLegend>2 — Tax IDs</FieldLegend>
              <ItemGroup>
                <Detail label="GSTIN" value={company.gstin} />
                <Detail label="PAN" value={company.pan} />
              </ItemGroup>
            </FieldSet>
            <Separator />
            <FieldSet>
              <FieldLegend>3 — Bank</FieldLegend>
              <ItemGroup>
                <Detail label="Account number" value={company.bank_account} />
                <Detail label="IFSC" value={company.bank_ifsc} />
              </ItemGroup>
            </FieldSet>
            <Separator />
            <FieldSet>
              <FieldLegend>4 — Documents</FieldLegend>
              <ItemGroup>
                {docs.map((doc) => (
                  <Item key={doc.label} variant="outline">
                    <ItemContent>
                      <ItemTitle>{doc.label}</ItemTitle>
                      <ItemDescription>
                        filed as {doc.against || "—"}
                      </ItemDescription>
                      <DocPreview
                        url={signedUrls[doc.label] ?? null}
                        path={doc.path}
                      />
                      {signedUrls[doc.label] ? (
                        <Button
                          render={
                            <a
                              href={signedUrls[doc.label]}
                              target="_blank"
                              rel="noopener noreferrer"
                            />
                          }
                          nativeButton={false}
                          variant="outline"
                          size="sm"
                        >
                          Open in new tab to zoom
                        </Button>
                      ) : null}
                    </ItemContent>
                  </Item>
                ))}
              </ItemGroup>
            </FieldSet>
            {company.kyb_status === "rejected" && company.rejection_note ? (
              <Alert variant="destructive">
                <AlertTitle>Previous note to supplier</AlertTitle>
                <AlertDescription>
                  {company.rejection_note}
                </AlertDescription>
              </Alert>
            ) : null}
          </CardContent>
        </Card>

        <div className="lg:sticky lg:top-6 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle>Decision</CardTitle>
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
              <CardAction>
                <Badge variant={status.variant}>{status.label}</Badge>
              </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {decidable ? (
                <DecisionForm id={company.id} />
              ) : (
                <Empty>
                  <EmptyTitle>Already decided</EmptyTitle>
                  <EmptyDescription>No action needed.</EmptyDescription>
                </Empty>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
