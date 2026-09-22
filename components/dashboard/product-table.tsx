"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Delete02Icon,
  Edit01Icon,
  MoreHorizontalIcon,
  SendIcon,
  ViewIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/components/ui/toast";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { deleteProduct, submitProduct } from "@/lib/supplier/product-actions";

export type ProductRow = {
  id: string;
  title: string;
  cover: string | null;
  category: string | null;
  rejectionNote: string | null;
  price: number;
  unit: string;
  moq: number | null;
  stock: number;
  status: string;
};

function ProductRowMenu({
  productId,
  title,
  status,
  verified,
  baseHref,
}: {
  productId: string;
  title: string;
  status: string;
  verified: boolean;
  baseHref: string;
}) {
  const [pending, start] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const router = useRouter();

  if (!verified) return null;

  const editable = status === "draft" || status === "rejected";

  const submit = () =>
    start(async () => {
      const result = await submitProduct(productId);
      if (result.ok) {
        toast.add({
          type: "success",
          title: "Submitted",
          description: result.message,
        });
        router.refresh();
      } else {
        toast.add({
          type: "error",
          title: "Could not submit",
          description: result.message,
        });
      }
    });

  const remove = () =>
    start(async () => {
      const result = await deleteProduct(productId);
      if (result.ok) {
        router.refresh();
      } else {
        toast.add({
          type: "error",
          title: "Could not delete",
          description: result.message,
        });
      }
    });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Actions for ${title}`}
            >
              <HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={2} />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="min-w-44">
          {status === "approved" ? (
            <>
              <DropdownMenuItem render={<Link href={`/products/${productId}`} />}>
                <HugeiconsIcon icon={ViewIcon} strokeWidth={2} />
                View
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          ) : null}
          <DropdownMenuItem render={<Link href={`${baseHref}/${productId}/edit`} />}>
            <HugeiconsIcon icon={Edit01Icon} strokeWidth={2} />
            Edit
          </DropdownMenuItem>
          {editable ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled={pending} onClick={submit}>
                <HugeiconsIcon icon={SendIcon} strokeWidth={2} />
                Submit for review
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                disabled={pending}
                onClick={() => setDeleteOpen(true)}
              >
                <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
                Delete
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent size="default">
          <AlertDialogHeader>
            <AlertDialogMedia>
              <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
            </AlertDialogMedia>
            <AlertDialogTitle>Delete this product?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes “{title}” and its images permanently. This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteOpen(false)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                setDeleteOpen(false);
                remove();
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function ProductTable({
  products,
  baseHref,
  verified,
}: {
  products: ProductRow[];
  baseHref: string;
  verified: boolean;
}) {
  const [selected, setSelected] = useState<string[]>([]);

  const visibleIds = products.map((p) => p.id);
  const allChecked =
    visibleIds.length > 0 && visibleIds.every((id) => selected.includes(id));
  const someChecked = selected.some((id) => visibleIds.includes(id));

  const toggleAll = (checked: boolean) => {
    if (checked) {
      setSelected(Array.from(new Set([...selected, ...visibleIds])));
    } else {
      setSelected(selected.filter((id) => !visibleIds.includes(id)));
    }
  };

  const toggleOne = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  return (
    <>
      {selected.length > 0 ? (
        <div className="flex items-center gap-2 border-b border-border bg-muted/50 px-4 py-2">
          <span className="text-sm tabular-nums">
            {selected.length} selected
          </span>
          <Button
            variant="ghost"
            size="xs"
            onClick={() => setSelected([])}
          >
            Clear
          </Button>
        </div>
      ) : null}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10 pl-4">
              <Checkbox
                checked={allChecked}
                indeterminate={someChecked}
                disabled={products.length === 0}
                onCheckedChange={toggleAll}
                aria-label="Select all products on this page"
              />
            </TableHead>
            <TableHead>Product</TableHead>
            <TableHead>Price</TableHead>
            <TableHead className="hidden sm:table-cell">Inventory</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((p) => (
            <TableRow key={p.id} data-state={selected.includes(p.id) ? "selected" : undefined}>
              <TableCell className="pl-4">
                <Checkbox
                  checked={selected.includes(p.id)}
                  onCheckedChange={() => toggleOne(p.id)}
                  aria-label={`Select ${p.title}`}
                />
              </TableCell>
              <TableCell>
                <div className="flex min-w-0 items-center gap-3">
                  <span className="relative hidden size-10 shrink-0 overflow-hidden rounded-md border border-border bg-muted sm:block">
                    {p.cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.cover}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </span>
                  <div className="min-w-0">
                    <Link
                      href={`${baseHref}/${p.id}/edit`}
                      className="block max-w-44 truncate font-medium hover:underline lg:max-w-64"
                    >
                      {p.title}
                    </Link>
                    {p.status === "rejected" && p.rejectionNote ? (
                      <span className="block max-w-44 truncate text-xs text-destructive lg:max-w-64">
                        {p.rejectionNote}
                      </span>
                    ) : p.category ? (
                      <span className="block max-w-44 truncate text-xs text-muted-foreground lg:max-w-64">
                        {p.category}
                      </span>
                    ) : null}
                  </div>
                </div>
              </TableCell>
              <TableCell className="whitespace-nowrap">
                <span className="tabular-nums font-medium">
                  ₹{p.price.toLocaleString("en-IN")}
                </span>
                <span className="text-muted-foreground"> / {p.unit}</span>
                {p.moq != null ? (
                  <span className="mt-0.5 block text-xs tabular-nums text-muted-foreground">
                    MOQ {p.moq}
                  </span>
                ) : null}
              </TableCell>
              <TableCell className="hidden whitespace-nowrap tabular-nums sm:table-cell">
                {p.stock > 0 ? (
                  p.stock
                ) : (
                  <span className="text-destructive">Out of stock</span>
                )}
              </TableCell>
              <TableCell>
                <StatusBadge status="product" value={p.status} />
              </TableCell>
              <TableCell>
                <div className="flex justify-end">
                  <ProductRowMenu
                    productId={p.id}
                    title={p.title}
                    status={p.status}
                    verified={verified}
                    baseHref={baseHref}
                  />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}