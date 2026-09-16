import { HugeiconsIcon } from "@hugeicons/react";
import { Tick01Icon } from "@hugeicons/core-free-icons";
import { cn } from "cn";
import Link from "next/link";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export type ProfileChecklistItem = { label: string; done: boolean };

export function profileChecklist(company: Record<string, unknown>): {
  score: number;
  items: ProfileChecklistItem[];
} {
  const items: ProfileChecklistItem[] = [
    { label: "Company name", done: Boolean(company.business_name) },
    { label: "Contact person", done: Boolean(company.contact_person) },
    { label: "Mobile", done: Boolean(company.phone) },
    { label: "City", done: Boolean(company.city) },
    { label: "Registered address", done: Boolean(company.address) },
    { label: "GSTIN", done: Boolean(company.gstin) },
    { label: "PAN", done: Boolean(company.pan) },
    { label: "Bank account", done: Boolean(company.bank_account) },
    { label: "IFSC code", done: Boolean(company.bank_ifsc) },
    { label: "One document uploaded", done: Boolean(company.logo_path) },
  ];
  const done = items.filter((i) => i.done).length;
  return { score: Math.round((done / items.length) * 100), items };
}

export function ProfileCompletionCard({
  score,
  items,
  hint,
}: {
  score: number;
  items: ProfileChecklistItem[];
  hint?: string;
}) {
  const missing = items.filter((i) => !i.done);
  return (
    <Card size="sm" className="!gap-0 !py-0">
      <CardHeader className="flex w-full flex-row items-center justify-between border-b border-border gap-2">
        <div className="grid gap-0.5">
          <CardTitle>Profile completeness</CardTitle>
          <CardDescription>
            {missing.length === 0
              ? "Everything we have on file is filled in."
              : hint ?? `${missing.length} detail${missing.length === 1 ? "" : "s"} still missing.`}
          </CardDescription>
        </div>
        <span className="text-2xl font-semibold tracking-tight tabular-nums">
          {score}%
        </span>
      </CardHeader>
      <div className="flex flex-col gap-4 px-5 py-4">
        <Progress value={score} className="[&_div]:h-2" />
        {missing.length > 0 ? (
          <ul className="flex flex-col gap-1">
            {missing.map((item) => (
              <li key={item.label} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate text-muted-foreground">{item.label}</span>
                <Link
                  href="/supplier/dashboard/business"
                  className="shrink-0 font-medium text-primary hover:underline"
                >
                  Add
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="flex flex-col gap-1">
            {items.map((item) => (
              <li key={item.label} className="flex items-center gap-2 text-sm">
                <HugeiconsIcon
                  icon={Tick01Icon}
                  strokeWidth={2}
                  className={cn("size-4 text-success")}
                />
                <span className="truncate">{item.label}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}