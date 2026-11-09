"use client";

import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { CheckmarkCircle01Icon } from "@hugeicons/core-free-icons";

const STEPS = [
  { label: "Basic info", href: (id: string) => `/supplier/dashboard/products/${id}/edit` },
  { label: "Images", href: (id: string) => `/supplier/dashboard/products/${id}/images` },
  { label: "Additional info", href: (id: string) => `/supplier/dashboard/products/${id}/additional` },
];

export function ProductWizardSteps({
  productId,
  currentStep,
}: {
  productId: string;
  currentStep: 1 | 2 | 3;
}) {
  return (
    <nav aria-label="Product creation steps" className="mb-6">
      <ol className="flex items-center gap-2">
        {STEPS.map((step, index) => {
          const stepNumber = index + 1;
          const isCurrent = stepNumber === currentStep;
          const isDone = stepNumber < currentStep;
          return (
            <li key={step.label} className="flex items-center gap-2">
              <Link
                href={step.href(productId)}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  isCurrent
                    ? "bg-primary text-primary-foreground"
                    : isDone
                      ? "bg-muted text-foreground hover:bg-muted/80"
                      : "text-muted-foreground"
                }`}
                aria-current={isCurrent ? "step" : undefined}
              >
                {isDone ? (
                  <HugeiconsIcon icon={CheckmarkCircle01Icon} strokeWidth={2} className="size-4" />
                ) : (
                  <span className="flex size-5 items-center justify-center rounded-full border border-current text-xs">
                    {stepNumber}
                  </span>
                )}
                {step.label}
              </Link>
              {index < STEPS.length - 1 ? (
                <span className="text-muted-foreground">→</span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
