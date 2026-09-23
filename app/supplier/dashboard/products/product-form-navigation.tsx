"use client";

import { useEffect, useState } from "react";
import { cn } from "cn";
import { PRODUCT_FORM_SECTIONS } from "./product-form-sections";

export function useScrollSpy(ids: readonly string[]): string {
  const [active, setActive] = useState(ids[0] ?? "");
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .map((e) => e.target.id);
        if (visible.length > 0) setActive(visible[visible.length - 1]);
      },
      { rootMargin: "-96px 0px -65% 0px", threshold: 0 },
    );
    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (elements.length > 0) elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [ids]);
  return active;
}

const sectionIds = PRODUCT_FORM_SECTIONS.map((s) => s.id);

export function ProductFormSectionNav() {
  const active = useScrollSpy(sectionIds);
  return (
    <nav aria-label="Product sections">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        On this page
      </p>
      <ul className="mt-2 flex flex-col gap-1">
        {PRODUCT_FORM_SECTIONS.map((s) => {
          const isActive = active === s.id;
          return (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                aria-current={isActive ? "true" : undefined}
                className={cn(
                  "block rounded-md px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-secondary font-medium text-foreground"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                )}
              >
                {s.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function ProductFormSectionTabs() {
  const active = useScrollSpy(sectionIds);
  return (
    <nav
      aria-label="Product sections"
      className="-mx-4 mb-4 overflow-x-auto px-4 @3xl/content:hidden"
    >
      <ul className="flex gap-2">
        {PRODUCT_FORM_SECTIONS.map((s) => (
          <li key={s.id} className="shrink-0">
            <a
              href={`#${s.id}`}
              aria-current={active === s.id ? "true" : undefined}
              className={cn(
                "inline-flex h-9 items-center rounded-md border px-3 text-sm transition-colors",
                active === s.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}