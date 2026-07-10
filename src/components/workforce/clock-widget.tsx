"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Clock, LogIn, LogOut, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  clockInAction,
  clockOutAction,
  getMyShiftAction,
} from "@/features/workforce/actions";
import type { WorkShift } from "@/lib/db/work-shifts";
import { cn } from "@/lib/utils";

function getGps(): Promise<{
  latitude: number;
  longitude: number;
  accuracyMeters: number;
}> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported on this device"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracyMeters: pos.coords.accuracy,
        }),
      (err) => reject(new Error(err.message || "Could not get location")),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

export function ClockWidget() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [shift, setShift] = useState<WorkShift | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(async () => {
    const active = await getMyShiftAction();
    setShift(active);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!shift) return;
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, [shift, tick]);

  const clockIn = () => {
    startTransition(async () => {
      try {
        const gps = await getGps();
        const result = await clockInAction(gps);
        if (result.error) toast.error(result.error);
        else {
          toast.success("Clocked in");
          setShift(result.shift ?? null);
          router.refresh();
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Location denied");
      }
    });
  };

  const clockOut = () => {
    startTransition(async () => {
      try {
        const gps = await getGps();
        const result = await clockOutAction(gps);
        if (result.error) toast.error(result.error);
        else {
          toast.success("Clocked out");
          setShift(null);
          router.refresh();
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Location denied");
      }
    });
  };

  const isIn = Boolean(shift);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "gap-2 border-white/10",
              isIn && "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
            )}
          >
            <Clock className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{isIn ? "On shift" : "Clock"}</span>
          </Button>
        }
      />
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Time clock</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            GPS is recorded when you clock in and out. Allow location access in your browser.
          </p>

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : isIn && shift ? (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-sm">
              <p className="font-medium text-emerald-300">Currently clocked in</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Since {formatDistanceToNow(new Date(shift.clock_in_at), { addSuffix: true })}
              </p>
              {shift.clock_in_latitude != null && shift.clock_in_longitude != null && (
                <a
                  href={`https://maps.google.com/?q=${shift.clock_in_latitude},${shift.clock_in_longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 flex items-center gap-1 text-xs text-violet-400 hover:underline"
                >
                  <MapPin className="h-3 w-3" />
                  View clock-in location
                </a>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">You are off the clock.</p>
          )}

          <div className="flex gap-2">
            {!isIn ? (
              <Button
                className="flex-1 gap-2"
                size="sm"
                disabled={pending}
                onClick={clockIn}
              >
                <LogIn className="h-3.5 w-3.5" />
                Clock in
              </Button>
            ) : (
              <Button
                className="flex-1 gap-2"
                size="sm"
                variant="destructive"
                disabled={pending}
                onClick={clockOut}
              >
                <LogOut className="h-3.5 w-3.5" />
                Clock out
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
