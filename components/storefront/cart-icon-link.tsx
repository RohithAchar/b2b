import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { ShoppingCart01Icon } from "@hugeicons/core-free-icons";
import { cn } from "cn";

export function CartIconLink({ count, className }: { count: number; className?: string }) {
  return (
    <Link
      href="/cart"
      aria-label={count > 0 ? `Cart, ${count} item${count > 1 ? "s" : ""}` : "Cart"}
      className={cn(
        "relative flex size-9 items-center justify-center rounded-md text-foreground/80 transition-colors hover:bg-muted hover:text-foreground",
        className,
      )}
    >
      <HugeiconsIcon icon={ShoppingCart01Icon} strokeWidth={2} className="size-5" />
      {count > 0 && (
        <span className="absolute top-0.5 right-0.5 min-w-4 rounded-sm bg-primary px-0.5 text-center text-[10px] leading-4 font-bold text-primary-foreground">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
