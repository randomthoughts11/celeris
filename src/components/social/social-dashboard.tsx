"use client";

import { motion } from "framer-motion";
import { Globe, Share2, Video } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatNumber } from "@/lib/format";
import type { SocialMetrics, SocialPlatform } from "@/types";

const platformIcons: Record<SocialPlatform, React.ComponentType<{ className?: string }>> = {
  facebook: Globe,
  instagram: Share2,
  linkedin: Globe,
  x: () => <span className="text-sm font-bold">𝕏</span>,
  youtube: Video,
};

const platformLabels: Record<SocialPlatform, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  x: "X",
  youtube: "YouTube",
};

interface SocialDashboardProps {
  metrics: SocialMetrics[];
}

export function SocialDashboard({ metrics }: SocialDashboardProps) {
  if (metrics.length === 0) {
    return (
      <Card className="border-white/5 bg-white/[0.02] p-12 text-center">
        <p className="text-muted-foreground">
          No social accounts connected. Connect platforms in settings.
        </p>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {metrics.map((m, i) => {
        const Icon = platformIcons[m.platform];
        return (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card className="border-white/5 bg-white/[0.02] p-6 backdrop-blur-sm">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-semibold">{platformLabels[m.platform]}</h3>
                  <p className="text-sm text-muted-foreground">
                    {m.posting_frequency ?? "—"} posting
                  </p>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-sm text-emerald-400">
                    +{m.growth_percent}%
                  </p>
                  <p className="text-xs text-muted-foreground">growth</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <Metric label="Followers" value={formatNumber(m.followers)} />
                <Metric label="Reach" value={formatNumber(m.reach)} />
                <Metric label="Engagement" value={formatNumber(m.engagement)} />
                <Metric label="Likes" value={formatNumber(m.likes)} />
                <Metric label="Comments" value={formatNumber(m.comments)} />
                <Metric label="Shares" value={formatNumber(m.shares)} />
                {m.views > 0 && (
                  <Metric label="Views" value={formatNumber(m.views)} />
                )}
                {m.saves > 0 && (
                  <Metric label="Saves" value={formatNumber(m.saves)} />
                )}
              </div>
            </Card>
          </motion.div>
        );
      })}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
