import {
  ChipRowSkeleton,
  KpiRowSkeleton,
  PageHeaderSkeleton,
  TableCardSkeleton,
} from "@/components/dashboard/skeletons"

export default function SupplierOrdersLoading() {
  return (
    <div aria-hidden className="flex w-full flex-col gap-5">
      <PageHeaderSkeleton action="link" />
      <KpiRowSkeleton />
      <ChipRowSkeleton
        widths={[
          "w-16",
          "w-24",
          "w-24",
          "w-20",
          "w-20",
          "w-24",
          "w-20",
          "w-24",
        ]}
      />
      <TableCardSkeleton rows={8} columns={8} toolbar />
    </div>
  )
}
