"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Phone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { logManualCallAction } from "@/features/calls/actions";
import type { Lead, RingCentralCall } from "@/types";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { formatDuration } from "@/lib/format";

interface CallLogClientProps {
  companyId: string;
  calls: RingCentralCall[];
  leads: Lead[];
}

export function CallLogClient({ companyId, calls, leads }: CallLogClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const prefillLead = searchParams.get("log") ?? "";
  const prefillPhone = searchParams.get("phone") ?? "";

  const answered = calls.filter((c) => c.outcome === "answered");
  const missed = calls.filter((c) => c.outcome === "missed");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Call Log</h1>
        <p className="text-muted-foreground">
          Manual call tracking — no RingCentral API required. Log calls after you dial from your phone.
        </p>
      </div>

      <Card className="border-violet-500/20 bg-violet-500/5 p-6">
        <h2 className="mb-4 flex items-center gap-2 font-semibold">
          <Phone className="h-4 w-4" />
          Log a call
        </h2>
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            startTransition(async () => {
              const result = await logManualCallAction(companyId, {
                leadId: String(fd.get("leadId") || "") || undefined,
                direction: String(fd.get("direction")) as "inbound" | "outbound",
                outcome: String(fd.get("outcome")),
                phone: String(fd.get("phone")),
                durationSeconds: Number(fd.get("duration") || 0),
                notes: String(fd.get("notes") || "") || undefined,
              });
              if (result.error) toast.error(result.error);
              else {
                toast.success("Call logged");
                router.refresh();
                (e.target as HTMLFormElement).reset();
              }
            });
          }}
        >
          <div>
            <Label>Phone number</Label>
            <Input name="phone" required defaultValue={prefillPhone} placeholder="+91..." />
          </div>
          <div>
            <Label>Link to lead (optional)</Label>
            <Select name="leadId" defaultValue={prefillLead || undefined}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select lead" />
              </SelectTrigger>
              <SelectContent>
                {leads.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.first_name} {l.last_name ?? ""} — {l.phone}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Direction</Label>
            <Select name="direction" defaultValue="outbound">
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="outbound">Outbound</SelectItem>
                <SelectItem value="inbound">Inbound</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Outcome</Label>
            <Select name="outcome" defaultValue="answered">
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="answered">Answered</SelectItem>
                <SelectItem value="missed">Missed</SelectItem>
                <SelectItem value="voicemail">Voicemail</SelectItem>
                <SelectItem value="busy">Busy</SelectItem>
                <SelectItem value="failed">No answer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Duration (seconds)</Label>
            <Input name="duration" type="number" min={0} defaultValue={0} />
          </div>
          <div className="sm:col-span-2">
            <Label>Notes</Label>
            <Textarea name="notes" rows={2} placeholder="Call summary…" />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save call log"}
            </Button>
          </div>
        </form>
      </Card>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-white/5 bg-white/[0.03] p-5">
          <p className="text-sm text-muted-foreground">Total logged</p>
          <p className="text-2xl font-semibold">{calls.length}</p>
        </Card>
        <Card className="border-white/5 bg-white/[0.03] p-5">
          <p className="text-sm text-muted-foreground">Answered</p>
          <p className="text-2xl font-semibold text-emerald-400">{answered.length}</p>
        </Card>
        <Card className="border-white/5 bg-white/[0.03] p-5">
          <p className="text-sm text-muted-foreground">Missed</p>
          <p className="text-2xl font-semibold text-red-400">{missed.length}</p>
        </Card>
      </div>

      <div className="space-y-3">
        {calls.map((call) => (
          <Card key={call.id} className="border-white/5 bg-white/[0.02] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{call.direction}</Badge>
                <Badge variant={call.outcome === "answered" ? "outline" : "destructive"}>
                  {call.outcome}
                </Badge>
                <span className="text-sm">
                  {call.caller} → {call.receiver}
                </span>
                {(call.metadata as { source?: string })?.source === "manual" && (
                  <Badge variant="secondary" className="text-xs">
                    Manual
                  </Badge>
                )}
              </div>
              <div className="text-right text-sm text-muted-foreground">
                <p>{format(new Date(call.started_at), "MMM d, h:mm a")}</p>
                {call.duration_seconds > 0 && (
                  <p>{formatDuration(call.duration_seconds)}</p>
                )}
              </div>
            </div>
            {call.notes && (
              <p className="mt-2 text-sm text-muted-foreground">{call.notes}</p>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
