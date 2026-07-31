import { format } from "date-fns";
import { MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { WorkShiftWithUser } from "@/lib/db/work-shifts";

function mapsLink(lat: number, lng: number) {
  return `https://maps.google.com/?q=${lat},${lng}`;
}

function GpsLink({
  lat,
  lng,
  label,
}: {
  lat: number | null;
  lng: number | null;
  label: string;
}) {
  if (lat == null || lng == null) {
    return <span className="text-xs text-muted-foreground">No GPS</span>;
  }
  return (
    <a
      href={mapsLink(lat, lng)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs text-violet-400 hover:underline"
    >
      <MapPin className="h-3 w-3" />
      {label}
    </a>
  );
}

function shiftDuration(shift: WorkShiftWithUser) {
  const start = new Date(shift.clock_in_at);
  const end = shift.clock_out_at ? new Date(shift.clock_out_at) : new Date();
  const mins = Math.round((end.getTime() - start.getTime()) / 60_000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

interface TeamAttendancePanelProps {
  active: WorkShiftWithUser[];
  recent: WorkShiftWithUser[];
}

export function TeamAttendancePanel({ active, recent }: TeamAttendancePanelProps) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">Attendance &amp; GPS</h2>

      <Card className="border-white/5 bg-white/[0.02] p-5">
        <h3 className="mb-3 text-sm font-medium text-emerald-400">
          Clocked in now ({active.length})
        </h3>
        {active.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nobody is on the clock right now.</p>
        ) : (
          <ul className="space-y-3">
            {active.map((shift) => (
              <li
                key={shift.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/5 p-3"
              >
                <div>
                  <p className="font-medium">{shift.user_name}</p>
                  <p className="text-xs text-muted-foreground">
                    Login {format(new Date(shift.clock_in_at), "MMM d, h:mm a")}
                  </p>
                </div>
                <GpsLink
                  lat={shift.clock_in_latitude}
                  lng={shift.clock_in_longitude}
                  label="Clock-in GPS"
                />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="overflow-hidden border-white/5 bg-white/[0.02]">
        <div className="border-b border-white/5 px-5 py-3">
          <h3 className="text-sm font-medium">Recent shifts</h3>
        </div>
        <ul className="divide-y divide-white/5">
          {recent.map((shift) => (
            <li key={shift.id} className="flex flex-wrap gap-4 p-4 text-sm">
              <div className="min-w-[140px]">
                <p className="font-medium">{shift.user_name}</p>
                <p className="text-xs text-muted-foreground">
                  Login {format(new Date(shift.clock_in_at), "MMM d, h:mm a")}
                  {shift.clock_out_at
                    ? ` · Logout ${format(new Date(shift.clock_out_at), "h:mm a")}`
                    : " · Still on shift"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">{shiftDuration(shift)}</Badge>
                {!shift.clock_out_at && (
                  <Badge className="bg-emerald-500/20 text-emerald-300">Active</Badge>
                )}
              </div>
              <div className="flex flex-wrap gap-3">
                <GpsLink
                  lat={shift.clock_in_latitude}
                  lng={shift.clock_in_longitude}
                  label="In"
                />
                {shift.clock_out_at && (
                  <GpsLink
                    lat={shift.clock_out_latitude}
                    lng={shift.clock_out_longitude}
                    label="Out"
                  />
                )}
              </div>
            </li>
          ))}
          {recent.length === 0 && (
            <li className="p-8 text-center text-muted-foreground">No shifts logged yet.</li>
          )}
        </ul>
      </Card>
    </section>
  );
}
