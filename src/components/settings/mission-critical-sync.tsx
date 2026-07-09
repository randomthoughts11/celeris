"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface MissionCriticalSyncProps {
  appUrl: string;
  companies: { id: string; name: string }[];
  privyrSecretConfigured: boolean;
}

export function MissionCriticalSync({
  appUrl,
  companies,
  privyrSecretConfigured,
}: MissionCriticalSyncProps) {
  const router = useRouter();
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const [pending, startTransition] = useTransition();

  const privyrImportUrl = `${appUrl}/api/integrations/privyr/import`;

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied");
  };

  const uploadCsv = (file: File) => {
    if (!companyId) {
      toast.error("Select a company first");
      return;
    }
    startTransition(async () => {
      const fd = new FormData();
      fd.set("companyId", companyId);
      fd.set("file", file);
      const res = await fetch("/api/integrations/privyr/import", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) toast.error(data.error ?? "Import failed");
      else toast.success(`Imported ${data.processed} rows (${data.created} new)`);
      router.refresh();
    });
  };

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Privyr sync</h2>
        <p className="text-sm text-muted-foreground">
          Privyr has no public API for activity logs. Automate CSV exports via Zapier
          or upload manually below.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Default company for sync</Label>
        <Select value={companyId} onValueChange={(v) => setCompanyId(v ?? "")}>
          <SelectTrigger className="w-full max-w-sm">
            <SelectValue placeholder="Select company" />
          </SelectTrigger>
          <SelectContent>
            {companies.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="space-y-4 border-amber-500/20 bg-amber-500/5 p-5">
        <h3 className="font-semibold">Zapier automation</h3>
        <p className="text-sm text-muted-foreground">
          In Privyr: Integrations → Export Client List → &quot;Since Last
          Export&quot;. In Zapier: trigger on Privyr export email → POST CSV to
          this URL with header <code className="text-xs">x-webhook-secret</code> and
          form field <code className="text-xs">companyId</code>.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <code className="rounded bg-black/30 px-2 py-1 text-xs">{privyrImportUrl}</code>
          <Button size="sm" variant="outline" onClick={() => copy(privyrImportUrl)}>
            <Copy className="h-3 w-3" />
          </Button>
        </div>
        {!privyrSecretConfigured && (
          <p className="text-xs text-amber-400">
            Add PRIVR_SYNC_WEBHOOK_SECRET on Vercel for automated CSV pushes.
          </p>
        )}
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Zapier → Email (or Privyr export trigger) → New attachment</li>
          <li>Webhooks by Zapier → POST → paste URL above</li>
          <li>Header: x-webhook-secret = your secret</li>
          <li>Body: companyId = {companyId || "select company UUID"}</li>
        </ol>
        <div>
          <Label className="mb-2 block">Manual CSV upload</Label>
          <input
            type="file"
            accept=".csv"
            disabled={pending}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) uploadCsv(f);
            }}
            className="text-sm"
          />
        </div>
      </Card>

      <Card className="border-white/5 bg-white/[0.02] p-5">
        <h3 className="font-semibold">Long-term</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Dual-write leads from Meta/Google into Agency OS. Telecallers log calls in
          the Lead Inbox — that becomes your source of truth. Privyr export stays as
          backup sync until you migrate fully.
        </p>
      </Card>
    </section>
  );
}
