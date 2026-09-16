import { HugeiconsIcon } from "@hugeicons/react";
import { Tick01Icon } from "@hugeicons/core-free-icons";
import { cn } from "cn";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "./status-badge";

type VerificationCompany = Record<string, unknown>;

export function verificationSteps(company: VerificationCompany): {
  done: boolean;
  label: string;
}[] {
  return [
    {
      label: "Business details",
      done: Boolean(company.business_name && company.contact_person),
    },
    {
      label: "Contact and address",
      done: Boolean(
        company.phone && company.city && company.state && company.pincode,
      ),
    },
    {
      label: "Tax IDs (GSTIN, PAN)",
      done: Boolean(company.gstin && company.pan),
    },
    {
      label: "Bank details",
      done: Boolean(company.bank_account && company.bank_ifsc),
    },
    {
      label: "Supporting documents",
      done: Boolean(
        company.gst_certificate_path ||
          company.pan_card_path ||
          company.license_path,
      ),
    },
    {
      label: "Application submitted",
      done: Boolean(
        company.submitted_at || company.kyb_status !== "draft",
      ),
    },
  ];
}

export function VerificationChecklistCard({
  company,
}: {
  company: VerificationCompany;
}) {
  const steps = verificationSteps(company);
  const done = steps.filter((s) => s.done).length;
  const score = Math.round((done / steps.length) * 100);
  const editable = company.kyb_status === "draft" || company.kyb_status === "rejected";

  return (
    <Card size="sm" className="!gap-0 !py-0">
      <CardHeader className="flex w-full flex-row items-center justify-between border-b border-border gap-2">
        <div className="grid gap-0.5">
          <CardTitle>Verification</CardTitle>
          <CardDescription>
            {editable
              ? "Finish the checklist to send your application for review."
              : "Business verification checklist."}
          </CardDescription>
        </div>
        <StatusBadge status="kyb" value={String(company.kyb_status ?? "draft")} />
      </CardHeader>
      <div className="flex flex-col gap-4 px-5 py-4">
        <div className="flex items-center gap-3">
          <Progress value={score} className="flex-1 [&_div]:h-2" />
          <span className="text-sm font-semibold tabular-nums">
            {done}/{steps.length}
          </span>
        </div>
        <ul className="flex flex-col gap-1">
          {steps.map((step) => (
            <li key={step.label} className="flex items-center gap-2 text-sm">
              <span
                className={cn(
                  "flex size-4 shrink-0 items-center justify-center rounded-[4px]",
                  step.done ? "bg-success/10 text-success" : "bg-muted text-muted-foreground",
                )}
              >
                {step.done ? (
                  <HugeiconsIcon icon={Tick01Icon} strokeWidth={2} className="size-3" />
                ) : null}
              </span>
              <span
                className={cn(
                  "truncate",
                  step.done ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {step.label}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}