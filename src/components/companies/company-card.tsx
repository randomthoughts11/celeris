"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  Calendar,
  Heart,
  Kanban,
  Megaphone,
  Share2,
  Users,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { CompanyWithMetrics, UserRole } from "@/types";
import {
  formatCurrency,
  formatNumber,
  getHealthBg,
  getHealthColor,
  getInitials,
  getPostingStatusLabel,
} from "@/lib/format";
import { canSeeCompanyNavItem } from "@/lib/rbac/nav";
import { cn } from "@/lib/utils";

interface CompanyCardProps {
  company: CompanyWithMetrics;
  index: number;
  showFinancials?: boolean;
  roles?: UserRole[];
}

export function CompanyCard({
  company,
  index,
  showFinancials = false,
  roles = [],
}: CompanyCardProps) {
  const metrics = company.metrics;
  const posting = getPostingStatusLabel(
    metrics?.social_posting_status ?? "on_track"
  );
  const shortcuts = [
    {
      key: "leads" as const,
      href: `/companies/${company.slug}/leads`,
      label: "Inbox",
      icon: Users,
    },
    {
      key: "board" as const,
      href: `/companies/${company.slug}/board`,
      label: "Board",
      icon: Kanban,
    },
    {
      key: "publish" as const,
      href: `/companies/${company.slug}/publish`,
      label: "Publish",
      icon: Calendar,
    },
  ].filter((item) => canSeeCompanyNavItem(roles, item.key));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4 }}
    >
      <Card className="group relative overflow-hidden border-white/5 bg-white/[0.03] p-0 backdrop-blur-sm transition-all duration-300 hover:border-white/10 hover:bg-white/[0.05] hover:shadow-2xl hover:shadow-violet-500/5">
        <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-transparent to-blue-500/5 opacity-0 transition-opacity group-hover:opacity-100" />

        <Link href={`/companies/${company.slug}`} className="relative block p-6">
          <div className="mb-6 flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/20 to-blue-500/20 ring-1 ring-white/10">
                {company.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={company.logo_url}
                    alt={company.name}
                    className="h-10 w-10 rounded-xl object-cover"
                  />
                ) : (
                  <span className="text-lg font-bold text-violet-300">
                    {getInitials(company.name)}
                  </span>
                )}
              </div>
              <div>
                <h3 className="text-lg font-semibold tracking-tight">
                  {company.name}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {company.industry ?? "No industry set"}
                </p>
              </div>
            </div>

            <div
              className={cn(
                "flex items-center gap-1.5 rounded-full px-2.5 py-1",
                getHealthBg(company.health_score)
              )}
            >
              <Heart className={cn("h-3 w-3", getHealthColor(company.health_score))} />
              <span className={cn("text-sm font-medium", getHealthColor(company.health_score))}>
                {company.health_score}
              </span>
            </div>
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            <Badge variant="outline" className="border-white/10 bg-white/5">
              <Megaphone className="mr-1 h-3 w-3" />
              {metrics?.active_campaigns ?? 0} campaigns
            </Badge>
            <Badge
              variant={
                posting.variant === "success"
                  ? "default"
                  : posting.variant === "warning"
                    ? "secondary"
                    : "outline"
              }
              className="border-white/10"
            >
              <Share2 className="mr-1 h-3 w-3" />
              Social {posting.label}
            </Badge>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {showFinancials ? (
              <KpiItem
                icon={Wallet}
                label="Ad Spend"
                value={formatCurrency(metrics?.monthly_ad_spend ?? 0, {
                  compact: true,
                })}
              />
            ) : (
              <KpiItem
                icon={Heart}
                label="Health"
                value={String(company.health_score)}
              />
            )}
            <KpiItem
              icon={Users}
              label="Leads"
              value={formatNumber(metrics?.leads_count ?? 0)}
            />
            <KpiItem
              icon={Kanban}
              label="Board"
              value={formatNumber(metrics?.open_tasks ?? 0)}
            />
          </div>

          {showFinancials && (
            <div className="mt-4">
              <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
                <span>Budget used</span>
                <span>{(metrics?.budget_used_percent ?? 0).toFixed(0)}%</span>
              </div>
              <Progress
                value={metrics?.budget_used_percent ?? 0}
                className="h-1.5 bg-white/5"
              />
            </div>
          )}
        </Link>

        {shortcuts.length > 0 && (
          <div className="relative grid grid-cols-3 border-t border-white/8">
            {shortcuts.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className="flex items-center justify-center gap-1.5 py-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        )}
      </Card>
    </motion.div>
  );
}

function KpiItem({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3 w-3" />
        {label}
      </div>
      <p className="text-lg font-semibold tracking-tight">{value}</p>
    </div>
  );
}
