import type { ReactNode } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ShieldCheckIcon, Store01Icon, Tag01Icon } from "@hugeicons/core-free-icons";

export function AuthShell({
  heading,
  steps,
  children,
}: {
  heading: string;
  steps: string[];
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-svh bg-background lg:grid-cols-[1fr_480px]">
      <div className="hidden flex-col justify-between border-r border-border bg-card p-12 lg:flex">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
            B
          </span>
          <span className="text-lg font-bold tracking-tight">
            B2B Marketplace
          </span>
        </div>

        <div className="max-w-md">
          <p className="text-xs font-bold uppercase tracking-widest text-primary">
            Wholesale Marketplace from India
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-balance">
            {heading}
          </h1>

          <ol className="mt-8 flex max-w-md flex-col gap-3">
            {steps.map((step, i) => (
              <li
                key={step}
                className="flex items-start gap-3 rounded-lg border border-border bg-background px-4 py-3"
              >
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-bold text-primary">
                  {i + 1}
                </span>
                <span className="text-sm text-muted-foreground">{step}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="flex items-center gap-6 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <HugeiconsIcon icon={ShieldCheckIcon} strokeWidth={2} className="size-4 text-success" />
            Verified suppliers
          </span>
          <span className="inline-flex items-center gap-1.5">
            <HugeiconsIcon icon={Store01Icon} strokeWidth={2} className="size-4 text-primary" />
            Direct sourcing
          </span>
          <span className="inline-flex items-center gap-1.5">
            <HugeiconsIcon icon={Tag01Icon} strokeWidth={2} className="size-4 text-brand-dark" />
            Wholesale pricing
          </span>
        </div>
      </div>
      <div className="flex items-center justify-center p-6">{children}</div>
    </div>
  );
}