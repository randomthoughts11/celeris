export function formatCurrency(
  value: number,
  options?: { compact?: boolean }
): string {
  if (options?.compact && value >= 1000) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatNumber(value: number, compact = false): string {
  return new Intl.NumberFormat("en-US", {
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 0,
  }).format(value);
}

export function formatPercent(value: number, decimals = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

export function formatRoas(value: number): string {
  return `${value.toFixed(1)}x`;
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function getHealthColor(score: number): string {
  if (score >= 80) return "text-emerald-400";
  if (score >= 60) return "text-amber-400";
  return "text-red-400";
}

export function getHealthBg(score: number): string {
  if (score >= 80) return "bg-emerald-500/20";
  if (score >= 60) return "bg-amber-500/20";
  return "bg-red-500/20";
}

export function getPostingStatusLabel(status: string): {
  label: string;
  variant: "success" | "warning" | "default";
} {
  switch (status) {
    case "ahead":
      return { label: "Ahead", variant: "success" };
    case "behind":
      return { label: "Behind", variant: "warning" };
    default:
      return { label: "On Track", variant: "default" };
  }
}

export function getCampaignStatusColor(
  status: string
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "active":
      return "default";
    case "paused":
      return "secondary";
    case "ended":
      return "destructive";
    default:
      return "outline";
  }
}

export function getSeverityColor(severity: string): string {
  switch (severity) {
    case "critical":
      return "border-red-500/30 bg-red-500/10";
    case "warning":
      return "border-amber-500/30 bg-amber-500/10";
    case "success":
      return "border-emerald-500/30 bg-emerald-500/10";
    default:
      return "border-blue-500/30 bg-blue-500/10";
  }
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}
