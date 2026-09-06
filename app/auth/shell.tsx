import type { ReactNode } from "react";

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
    <div className="grid min-h-svh lg:grid-cols-[1fr_480px]">
      <div className="hidden flex-col justify-center gap-8 border-r border-border p-12 lg:flex">
        <p className="text-lg font-medium">B2B Marketplace</p>
        <h1 className="max-w-md text-3xl font-medium text-balance">
          {heading}
        </h1>
        <ol className="flex max-w-md flex-col gap-4">
          {steps.map((step, i) => (
            <li key={step} className="flex items-start gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border text-xs font-medium">
                {i + 1}
              </span>
              <span className="text-sm text-muted-foreground">{step}</span>
            </li>
          ))}
        </ol>
      </div>
      <div className="flex items-center justify-center p-6">{children}</div>
    </div>
  );
}
