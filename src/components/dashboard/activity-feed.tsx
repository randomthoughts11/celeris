import { formatDistanceToNow } from "date-fns";
import { Card } from "@/components/ui/card";
import type { AuditLogEntry } from "@/lib/db/audit";

const actionLabels: Record<string, string> = {
  "task.created": "created a task",
  "task.status_changed": "updated task status",
  "task.time_logged": "logged time on a task",
  "lead.created": "added a lead",
  "lead.updated": "updated a lead",
  "company.created": "created a company",
};

interface ActivityFeedProps {
  entries: AuditLogEntry[];
  title?: string;
}

export function ActivityFeed({ entries, title = "Recent activity" }: ActivityFeedProps) {
  return (
    <Card className="border-white/5 bg-white/[0.02] p-5">
      <h3 className="mb-4 font-semibold">{title}</h3>
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
      ) : (
        <ul className="space-y-3">
          {entries.map((entry) => (
            <li key={entry.id} className="flex gap-3 text-sm">
              <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-violet-400" />
              <div className="min-w-0">
                <p>
                  <span className="font-medium">{entry.user_name ?? "Someone"}</span>{" "}
                  <span className="text-muted-foreground">
                    {actionLabels[entry.action] ?? entry.action}
                  </span>
                  {entry.company_name && (
                    <span className="text-muted-foreground"> · {entry.company_name}</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
