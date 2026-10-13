"use client";

import { useState } from "react";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowUpRight01Icon, Copy01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Public store URL with copy + open actions. The absolute URL is built in
 * the browser so the card works on any deployment without env plumbing.
 */
export function StoreLinkCard({ storePath }: { storePath: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}${storePath}`,
      );
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Card size="sm" className="!gap-0 !py-0">
      <CardHeader className="py-4">
        <CardTitle>Store link</CardTitle>
        <CardDescription>Your public storefront page.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 pb-4">
        <p className="truncate rounded-md border border-border bg-muted/40 px-3 py-2 font-mono text-xs text-muted-foreground">
          {storePath}
        </p>
        <div className="flex gap-2">
          <Button
            render={<Link href={storePath} />}
            nativeButton={false}
            variant="outline"
            size="sm"
            className="flex-1"
          >
            <HugeiconsIcon icon={ArrowUpRight01Icon} strokeWidth={2} data-icon="inline-start" />
            Open store
          </Button>
          <Button variant="outline" size="sm" className="flex-1" onClick={copy}>
            <HugeiconsIcon icon={Copy01Icon} strokeWidth={2} data-icon="inline-start" />
            {copied ? "Copied" : "Copy link"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
