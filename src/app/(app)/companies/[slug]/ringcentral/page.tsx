import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { getRingCentralCalls } from "@/features/companies/company-data";
import { getCompanyBySlug } from "@/features/companies/queries";
import { formatDuration } from "@/lib/format";
import { format } from "date-fns";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function RingCentralPage({ params }: PageProps) {
  const { slug } = await params;
  const company = await getCompanyBySlug(slug);
  if (!company) notFound();

  const calls = await getRingCentralCalls(company.id);
  const answered = calls.filter((c) => c.outcome === "answered");
  const missed = calls.filter((c) => c.outcome === "missed");
  const avgDuration =
    answered.length > 0
      ? Math.round(
          answered.reduce((s, c) => s + c.duration_seconds, 0) / answered.length
        )
      : 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Call Analytics
        </h1>
        <p className="text-muted-foreground">RingCentral integration</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="border-white/5 bg-white/[0.03] p-5">
          <p className="text-sm text-muted-foreground">Total Calls</p>
          <p className="text-2xl font-semibold">{calls.length}</p>
        </Card>
        <Card className="border-white/5 bg-white/[0.03] p-5">
          <p className="text-sm text-muted-foreground">Answered</p>
          <p className="text-2xl font-semibold text-emerald-400">
            {answered.length}
          </p>
        </Card>
        <Card className="border-white/5 bg-white/[0.03] p-5">
          <p className="text-sm text-muted-foreground">Missed</p>
          <p className="text-2xl font-semibold text-red-400">{missed.length}</p>
        </Card>
        <Card className="border-white/5 bg-white/[0.03] p-5">
          <p className="text-sm text-muted-foreground">Avg Duration</p>
          <p className="text-2xl font-semibold">{formatDuration(avgDuration)}</p>
        </Card>
      </div>

      <div className="space-y-3">
        {calls.map((call) => (
          <Card
            key={call.id}
            className="border-white/5 bg-white/[0.02] p-4 backdrop-blur-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Badge
                  variant={
                    call.direction === "inbound" ? "default" : "secondary"
                  }
                >
                  {call.direction}
                </Badge>
                <Badge
                  variant={
                    call.outcome === "answered" ? "outline" : "destructive"
                  }
                >
                  {call.outcome}
                </Badge>
                <span className="text-sm">
                  {call.caller} → {call.receiver}
                </span>
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
            {call.recording_url && (
              <a
                href={call.recording_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-xs text-violet-400 hover:underline"
              >
                Listen to recording
              </a>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
