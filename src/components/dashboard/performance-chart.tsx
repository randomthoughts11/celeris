"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import type { PerformanceSnapshot } from "@/types";

interface PerformanceChartProps {
  data: PerformanceSnapshot[];
  title: string;
  dataKey: keyof Pick<
    PerformanceSnapshot,
    "revenue" | "leads" | "conversions" | "ad_spend" | "roas"
  >;
  format?: "currency" | "number" | "roas";
}

export function PerformanceChart({
  data,
  title,
  dataKey,
  format = "number",
}: PerformanceChartProps) {
  const chartData = data.map((d) => ({
    date: new Date(d.snapshot_date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    value: d[dataKey],
  }));

  const formatValue = (val: number) => {
    if (format === "currency") return formatCurrency(val);
    if (format === "roas") return `${val.toFixed(1)}x`;
    return val.toLocaleString();
  };

  return (
    <Card className="border-border bg-card p-6 backdrop-blur-sm">
      <h3 className="mb-4 font-semibold">{title}</h3>
      <div className="h-[240px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#0c66e4" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#0c66e4" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis
              dataKey="date"
              stroke="#6b7280"
              fontSize={12}
              tickLine={false}
            />
            <YAxis
              stroke="#6b7280"
              fontSize={12}
              tickLine={false}
              tickFormatter={(v) =>
                format === "currency"
                  ? `$${(v / 1000).toFixed(0)}k`
                  : v.toString()
              }
            />
            <Tooltip
              contentStyle={{
                background: "#ffffff",
                border: "1px solid #e5e7eb",
                borderRadius: "8px",
              }}
              formatter={(value) => [formatValue(Number(value)), title]}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#0c66e4"
              strokeWidth={2}
              fill="url(#colorValue)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
