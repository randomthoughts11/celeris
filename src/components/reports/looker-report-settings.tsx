"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Link2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setLookerEmbedAction } from "@/features/companies/actions";

interface LookerReportSettingsProps {
  companyId: string;
  provider: "meta_ads" | "google_ads";
  currentUrl?: string;
  label: string;
}

export function LookerReportSettings({
  companyId,
  provider,
  currentUrl,
  label,
}: LookerReportSettingsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [url, setUrl] = useState(currentUrl ?? "");

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await setLookerEmbedAction(companyId, provider, url);
      if (result.error) toast.error(result.error);
      else {
        toast.success(`${label} dashboard saved`);
        router.refresh();
      }
    });
  };

  const clear = () => {
    setUrl("");
    startTransition(async () => {
      const result = await setLookerEmbedAction(companyId, provider, "");
      if (result.error) toast.error(result.error);
      else {
        toast.success(`${label} dashboard removed`);
        router.refresh();
      }
    });
  };

  return (
    <Card className="border-white/5 bg-white/[0.02] p-4">
      <form onSubmit={save} className="space-y-3">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-medium">{label} Looker Studio embed</p>
        </div>
        <p className="text-xs text-muted-foreground">
          Paste the embed URL from Looker Studio (File → Embed report).
        </p>
        <div className="space-y-2">
          <Label htmlFor={`${provider}-looker-url`} className="sr-only">
            {label} embed URL
          </Label>
          <Input
            id={`${provider}-looker-url`}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://lookerstudio.google.com/embed/reporting/..."
            className="font-mono text-xs"
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={pending}>
            Save dashboard
          </Button>
          {currentUrl && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={clear}
            >
              Remove
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}
