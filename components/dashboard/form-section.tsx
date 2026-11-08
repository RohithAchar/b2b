import { cn } from "cn";

export function FormSection({
  title,
  description,
  columns = 2,
  children,
  className,
  id,
}: {
  title: string;
  description?: string;
  columns?: 1 | 2;
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        "@container/form-section overflow-hidden rounded-2xl border border-border bg-card",
        className,
      )}
    >
      <header className="border-b border-border px-6 py-5">
        <h2 className="text-base font-medium">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        ) : null}
      </header>
      <div
        className={cn(
          "px-6 py-6",
          columns === 2
            ? "grid gap-x-8 gap-y-8 @3xl/form-section:grid-cols-2"
            : "grid gap-y-8",
        )}
      >
        {children}
      </div>
    </section>
  );
}