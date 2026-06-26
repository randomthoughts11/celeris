"use client";

import { format } from "date-fns";
import {
  Mail,
  MessageSquare,
  Phone,
  StickyNote,
  CheckSquare,
  Calendar,
  ArrowRight,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import type { Lead, LeadActivity } from "@/types";

const activityIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  call: Phone,
  email: Mail,
  message: MessageSquare,
  whatsapp: MessageSquare,
  note: StickyNote,
  task: CheckSquare,
  meeting: Calendar,
  follow_up: Calendar,
  status_change: ArrowRight,
  assignment: ArrowRight,
};

interface LeadTimelineProps {
  lead: Lead;
  activities: LeadActivity[];
}

export function LeadTimeline({ lead, activities }: LeadTimelineProps) {
  return (
    <div className="space-y-6">
      <Card className="border-white/5 bg-white/[0.02] p-6 backdrop-blur-sm">
        <h2 className="text-lg font-semibold">
          {lead.first_name} {lead.last_name}
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Info label="Email" value={lead.email} />
          <Info label="Phone" value={lead.phone} />
          <Info label="Source" value={lead.source} />
          <Info label="Score" value={String(lead.score)} />
          <Info label="Status" value={lead.status} />
          <Info label="Priority" value={lead.priority} />
        </div>
        {lead.notes && (
          <p className="mt-4 text-sm text-muted-foreground">{lead.notes}</p>
        )}
      </Card>

      <div>
        <h3 className="mb-4 text-lg font-semibold">Activity Timeline</h3>
        <div className="relative space-y-0">
          <div className="absolute left-5 top-2 bottom-2 w-px bg-white/10" />
          {activities.map((activity) => {
            const Icon = activityIcons[activity.activity_type] ?? StickyNote;
            return (
              <div key={activity.id} className="relative flex gap-4 pb-6">
                <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/5 ring-4 ring-background">
                  <Icon className="h-4 w-4 text-violet-400" />
                </div>
                <Card className="flex-1 border-white/5 bg-white/[0.02] p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium">{activity.title}</p>
                    <time className="shrink-0 text-xs text-muted-foreground">
                      {format(new Date(activity.created_at), "MMM d, h:mm a")}
                    </time>
                  </div>
                  {activity.description && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {activity.description}
                    </p>
                  )}
                </Card>
              </div>
            );
          })}
          {activities.length === 0 && (
            <p className="text-muted-foreground">No activity recorded yet</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value ?? "—"}</p>
    </div>
  );
}
