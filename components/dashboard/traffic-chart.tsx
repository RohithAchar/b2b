"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

/**
 * Generic single-series traffic area chart (views or visitors). The series
 * key drives both the config and the gradient id, so two instances can live
 * on one page without id collisions.
 */
export function TrafficChart({
  data,
  dataKey,
  label,
  color,
  formatValue = (value: number) => `${Math.round(value)}`,
}: {
  data: Record<string, string | number>[];
  dataKey: string;
  label: string;
  color: string;
  formatValue?: (value: number) => string;
}) {
  const config = {
    [dataKey]: { label, color },
  } satisfies ChartConfig;
  const fillId = `traffic-${dataKey}-fill`;

  return (
    <ChartContainer config={config} className="min-h-[200px] w-full">
      <AreaChart accessibilityLayer data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
        <defs>
          <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0.04} />
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
          width={48}
          allowDecimals={false}
          tickFormatter={(value: number) => formatValue(value)}
        />
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent formatter={(value) => formatValue(Number(value))} />}
        />
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          fill={`url(#${fillId})`}
          strokeWidth={2}
          dot={data.length <= 31 ? { fill: color, r: 2.5, strokeWidth: 0 } : false}
          activeDot={{ r: 4 }}
        />
      </AreaChart>
    </ChartContainer>
  );
}
