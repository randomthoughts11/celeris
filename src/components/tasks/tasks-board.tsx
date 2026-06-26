"use client";

import { format, isPast } from "date-fns";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { Task } from "@/types";
import { cn } from "@/lib/utils";

const statusLabels: Record<string, string> = {
  backlog: "Backlog",
  todo: "To Do",
  in_progress: "In Progress",
  review: "Review",
  blocked: "Blocked",
  done: "Done",
  cancelled: "Cancelled",
};

const typeLabels: Record<string, string> = {
  design: "Design",
  copywriting: "Copywriting",
  approval: "Approval",
  publishing: "Publishing",
  meeting: "Meeting",
  campaign_launch: "Campaign Launch",
  seo: "SEO",
  development: "Development",
  support: "Support",
  other: "Other",
};

interface TasksBoardProps {
  tasks: Task[];
}

export function TasksBoard({ tasks }: TasksBoardProps) {
  const columns = ["todo", "in_progress", "review", "done"] as const;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {columns.map((status) => {
        const columnTasks = tasks.filter((t) => t.status === status);
        return (
          <div key={status}>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
              {statusLabels[status]}
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs">
                {columnTasks.length}
              </span>
            </h3>
            <div className="space-y-2">
              {columnTasks.map((task, i) => (
                <TaskCard key={task.id} task={task} index={i} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TaskCard({ task, index }: { task: Task; index: number }) {
  const overdue =
    task.due_date &&
    isPast(new Date(task.due_date)) &&
    task.status !== "done";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card
        className={cn(
          "border-white/5 bg-white/[0.02] p-4 backdrop-blur-sm",
          overdue && "border-red-500/30"
        )}
      >
        <div className="flex flex-wrap gap-1">
          <Badge variant="outline" className="text-xs">
            {typeLabels[task.task_type]}
          </Badge>
          {task.priority === "high" || task.priority === "urgent" ? (
            <Badge variant="destructive" className="text-xs">
              {task.priority}
            </Badge>
          ) : null}
        </div>
        <p className="mt-2 font-medium">{task.title}</p>
        {task.description && (
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
            {task.description}
          </p>
        )}
        {task.due_date && (
          <p
            className={cn(
              "mt-2 text-xs",
              overdue ? "text-red-400" : "text-muted-foreground"
            )}
          >
            Due {format(new Date(task.due_date), "MMM d")}
            {overdue && " · Overdue"}
          </p>
        )}
      </Card>
    </motion.div>
  );
}
