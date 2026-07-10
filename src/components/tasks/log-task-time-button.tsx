"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { logTaskTimeAction } from "@/features/tasks/actions";

interface LogTaskTimeButtonProps {
  taskId: string;
  companyId: string;
  loggedMinutes?: number;
}

export function LogTaskTimeButton({
  taskId,
  companyId,
  loggedMinutes = 0,
}: LogTaskTimeButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [minutes, setMinutes] = useState("30");
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await logTaskTimeAction(
        taskId,
        companyId,
        Number(minutes),
        note
      );
      if (result.error) toast.error(result.error);
      else {
        toast.success("Time logged");
        setOpen(false);
        router.refresh();
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs">
            <Clock className="h-3 w-3" />
            {loggedMinutes > 0 ? `${loggedMinutes}m` : "Log time"}
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Log time on task</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="minutes">Minutes</Label>
            <Input
              id="minutes"
              type="number"
              min={1}
              max={1440}
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="note">Note (optional)</Label>
            <Input
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What did you work on?"
            />
          </div>
          <Button type="submit" disabled={pending}>
            Save
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
