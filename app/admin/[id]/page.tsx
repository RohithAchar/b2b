import Link from "next/link";
import { notFound } from "next/navigation";
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

const STATUS_LABEL: Record<string, string> = {
  draft: "Not submitted",
  pending: "Waiting for review",
  verified: "Approved",
  rejected: "Needs changes",
};

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm">{value || "—"}</span>
    </div>
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
      "id, business_name, contact_person, phone, address, city, state, pincode, gstin, pan, bank_account, bank_ifsc, gst_certificate_path, pan_card_path, license_path, kyb_status, rejection_note, submitted_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (!company) {
    notFound();
  }

  const docs = [
    { label: "GST certificate", path: company.gst_certificate_path },
    { label: "PAN card", path: company.pan_card_path },
    { label: "Business license", path: company.license_path },
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
    <div className="mx-auto w-full max-w-2xl p-6">
      <Card>
        <CardHeader>
          <CardTitle>{company.business_name}</CardTitle>
          <CardDescription>
            Status: {STATUS_LABEL[company.kyb_status] ?? company.kyb_status}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="flex flex-col gap-4">
            <h2 className="text-base font-medium">Business</h2>
            <Field label="Contact person" value={company.contact_person} />
            <Field label="Mobile" value={company.phone} />
            <Field
              label="Address"
              value={
                company.address
                  ? `${company.address}, ${company.city}, ${company.state} ${company.pincode}`
                  : null
              }
            />
          </div>
          <Separator />
          <div className="flex flex-col gap-4">
            <h2 className="text-base font-medium">Tax IDs</h2>
            <Field label="GSTIN" value={company.gstin} />
            <Field label="PAN" value={company.pan} />
          </div>
          <Separator />
          <div className="flex flex-col gap-4">
            <h2 className="text-base font-medium">Bank</h2>
            <Field label="Account number" value={company.bank_account} />
            <Field label="IFSC" value={company.bank_ifsc} />
          </div>
          <Separator />
          <div className="flex flex-col gap-4">
            <h2 className="text-base font-medium">Documents</h2>
            {docs.map((doc) => (
              <div key={doc.label} className="flex flex-col gap-1">
                <Label>{doc.label}</Label>
                {signedUrls[doc.label] ? (
                  <a
                    href={signedUrls[doc.label]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary underline underline-offset-4"
                  >
                    Open document
                  </a>
                ) : (
                  <span className="text-sm text-muted-foreground">Not uploaded</span>
                )}
              </div>
            ))}
          </div>
          {company.kyb_status === "rejected" && company.rejection_note ? (
            <>
              <Separator />
              <div className="flex flex-col gap-1">
                <Label>Previous note to supplier</Label>
                <p className="text-sm">{company.rejection_note}</p>
              </div>
            </>
          ) : null}
          <Separator />
          {decidable ? (
            <DecisionForm id={company.id} />
          ) : (
            <p className="text-sm text-muted-foreground">
              This application is already decided. Use the tabs to return to the queue.
            </p>
          )}
          <Button
            render={<Link href="/admin" />}
            nativeButton={false}
            variant="outline"
            className="w-full"
          >
            Back to queue
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
