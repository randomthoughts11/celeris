"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format, isPast } from "date-fns";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  createTaskAction,
  updateTaskStatusAction,
} from "@/features/tasks/actions";
import type { Task, TaskStatus } from "@/types";
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
  companyId: string;
}

export function TasksBoard({ tasks, companyId }: TasksBoardProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [taskType, setTaskType] = useState("other");
  const [priority, setPriority] = useState("medium");
  const columns = ["todo", "in_progress", "review", "done"] as const;

  const changeStatus = (taskId: string, status: TaskStatus) => {
    startTransition(async () => {
      await updateTaskStatusAction(taskId, companyId, status);
      router.refresh();
    });
  };

  const createTask = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    formData.set("taskType", taskType);
    formData.set("priority", priority);
    startTransition(async () => {
      const result = await createTaskAction(companyId, formData);
      if (result.error) toast.error(result.error);
      else {
        toast.success("Task created");
        setOpen(false);
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger
            render={
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                New task
              </Button>
            }
          />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create task</DialogTitle>
            </DialogHeader>
            <form onSubmit={createTask} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input id="title" name="title" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" name="description" rows={3} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select
                    value={taskType}
                    onValueChange={(v) => setTaskType(v ?? "other")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(typeLabels).map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select
                    value={priority}
                    onValueChange={(v) => setPriority(v ?? "medium")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dueDate">Due date</Label>
                <Input id="dueDate" name="dueDate" type="date" />
              </div>
              <Button type="submit" disabled={pending}>
                Create
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

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
                  <TaskCard
                    key={task.id}
                    task={task}
                    index={i}
                    onStatusChange={changeStatus}
                    disabled={pending}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TaskCard({
  task,
  index,
  onStatusChange,
  disabled,
}: {
  task: Task;
  index: number;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  disabled: boolean;
}) {
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
        <div className="mt-3">
          <Select
            value={task.status}
            onValueChange={(v) => onStatusChange(task.id, v as TaskStatus)}
            disabled={disabled}
          >
            <SelectTrigger className="h-7 w-full text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["todo", "in_progress", "review", "done", "blocked"] as const).map(
                (s) => (
                  <SelectItem key={s} value={s}>
                    {statusLabels[s]}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>
        </div>
      </Card>
    </motion.div>
  );
}
