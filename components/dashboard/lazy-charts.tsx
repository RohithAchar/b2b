"use client"

import dynamic from "next/dynamic"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * Recharts is ~344 KB of client JS. Charts sit below the fold on dashboard
 * screens, so they are loaded after hydration with a fixed-height placeholder
 * that reserves their space.
 */
function ChartFallback() {
  return <Skeleton className="h-[240px] w-full rounded-lg" />
}

export const SalesChart = dynamic(
  () => import("./sales-chart").then((mod) => mod.SalesChart),
  { ssr: false, loading: ChartFallback },
)
export const OrdersChart = dynamic(
  () => import("./orders-chart").then((mod) => mod.OrdersChart),
  { ssr: false, loading: ChartFallback },
)
export const ConversionChart = dynamic(
  () => import("./conversion-chart").then((mod) => mod.ConversionChart),
  { ssr: false, loading: ChartFallback },
)
export const TrafficChart = dynamic(
  () => import("./traffic-chart").then((mod) => mod.TrafficChart),
  { ssr: false, loading: ChartFallback },
)
