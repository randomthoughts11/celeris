"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: string;
  subValue?: string;
  trend?: "up" | "down" | "neutral";
  className?: string;
}

export function MetricCard({
  label,
  value,
  subValue,
  trend,
  className,
}: MetricCardProps) {
  return (
    <Card
      className={cn(
        "border-white/5 bg-white/[0.03] p-5 backdrop-blur-sm",
        className
      )}
    >
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
      {subValue && (
        <p
          className={cn(
            "mt-1 text-xs",
            trend === "up" && "text-emerald-400",
            trend === "down" && "text-red-400",
            trend === "neutral" && "text-muted-foreground"
          )}
        >
          {subValue}
        </p>
      )}
    </Card>
  );
}
