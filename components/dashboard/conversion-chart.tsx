"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const chartConfig = {
  rate: {
    label: "Conversion",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

/** Conversion-rate trend: % Y-axis, date labels, interactive tooltips. */
export function ConversionChart({ data }: { data: { label: string; rate: number }[] }) {
  return (
    <ChartContainer config={chartConfig} className="min-h-[240px] w-full">
      <AreaChart accessibilityLayer data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
        <defs>
          <linearGradient id="dashboardConversionFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-rate)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--color-rate)" stopOpacity={0.04} />
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
          width={52}
          tickFormatter={(value: number) => `${value}%`}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent formatter={(value) => `${Number(value)}%`} />
          }
        />
        <Area
          type="monotone"
          dataKey="rate"
          stroke="var(--color-rate)"
          fill="url(#dashboardConversionFill)"
          strokeWidth={2}
          dot={data.length <= 31 ? { fill: "var(--color-rate)", r: 2.5, strokeWidth: 0 } : false}
          activeDot={{ r: 4 }}
        />
      </AreaChart>
    </ChartContainer>
  );
}
