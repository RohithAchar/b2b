"use client";

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Copy01Icon, Tick01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";

export function CopyUpiButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked (insecure context); the id stays selectable.
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={copy}>
      <HugeiconsIcon icon={copied ? Tick01Icon : Copy01Icon} strokeWidth={2} />
      {copied ? "Copied" : "Copy UPI id"}
    </Button>
  );
}
