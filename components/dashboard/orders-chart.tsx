"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const chartConfig = {
  orders: {
    label: "Orders",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

/** Order-count trend: shaded area, integer Y-axis, interactive tooltips. */
export function OrdersChart({ data }: { data: { label: string; orders: number }[] }) {
  return (
    <ChartContainer config={chartConfig} className="min-h-[200px] w-full">
      <AreaChart accessibilityLayer data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="dashboardOrdersFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-orders)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--color-orders)" stopOpacity={0.04} />
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
          width={40}
          allowDecimals={false}
          tickFormatter={(value: number) => `${Math.round(value)}`}
        />
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <Area
          type="monotone"
          dataKey="orders"
          stroke="var(--color-orders)"
          fill="url(#dashboardOrdersFill)"
          strokeWidth={2}
          dot={data.length <= 31 ? { fill: "var(--color-orders)", r: 2.5, strokeWidth: 0 } : false}
          activeDot={{ r: 4 }}
        />
      </AreaChart>
    </ChartContainer>
  );
}
