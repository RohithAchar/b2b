import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import { Search01Icon, Store01Icon } from "@hugeicons/core-free-icons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function StorefrontSearchForm({
  autoFocus = false,
  showBrowseAll = false,
}: {
  autoFocus?: boolean
  showBrowseAll?: boolean
}) {
  return (
    <form
      action="/products"
      method="get"
      className="flex w-full items-center gap-2"
    >
      <input type="hidden" name="page" value="1" />
      <div className="relative flex-1">
        <Input
          name="q"
          autoFocus={autoFocus}
          placeholder="Search products, suppliers, brands or categories..."
          className="h-10 border-border bg-card pl-9 shadow-none"
        />
        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">
          <HugeiconsIcon
            icon={Search01Icon}
            strokeWidth={2}
            className="size-4"
          />
        </span>
      </div>
      <Button type="submit" size="lg" className="shrink-0 px-6">
        Search
      </Button>
      {showBrowseAll && (
        <Button
          variant="ghost"
          size="lg"
          type="button"
          className="hidden shrink-0 text-primary xl:inline-flex"
          render={<Link href="/products" />}
          nativeButton={false}
        >
          <HugeiconsIcon icon={Store01Icon} strokeWidth={2} />
          Browse All
        </Button>
      )}
    </form>
  )
}
