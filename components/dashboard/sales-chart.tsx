"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatIndianNumber, formatRupees } from "@/lib/format";

const chartConfig = {
  sales: {
    label: "Sales",
    color: "var(--primary)",
  },
} satisfies ChartConfig;

/**
 * Sales trend: shaded area + data points, ₹ Indian-grouped Y-axis,
 * interactive tooltips. Fed by server-computed buckets (no fetching here).
 */
export function SalesChart({ data }: { data: { label: string; sales: number }[] }) {
  return (
    <ChartContainer config={chartConfig} className="min-h-[240px] w-full">
      <AreaChart accessibilityLayer data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="dashboardSalesFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-sales)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--color-sales)" stopOpacity={0.04} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={24}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={64}
          tickFormatter={(value: number) => `₹${formatIndianNumber(value)}`}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              formatter={(value) => formatRupees(Number(value))}
            />
          }
        />
        <Area
          type="monotone"
          dataKey="sales"
          stroke="var(--color-sales)"
          fill="url(#dashboardSalesFill)"
          strokeWidth={2}
          dot={data.length <= 31 ? { fill: "var(--color-sales)", r: 2.5, strokeWidth: 0 } : false}
          activeDot={{ r: 4 }}
        />
      </AreaChart>
    </ChartContainer>
  );
}
