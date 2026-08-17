"use client";

import { useEffect, useState, useTransition } from "react";
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
import { getCompanyWebhookTokensAction } from "@/features/webhooks/actions";

interface MissionCriticalSyncProps {
  appUrl: string;
  companies: { id: string; name: string }[];
}

export function MissionCriticalSync({
  appUrl,
  companies,
}: MissionCriticalSyncProps) {
  const router = useRouter();
  const [companyId, setCompanyId] = useState(companies[0]?.id ?? "");
  const [pending, startTransition] = useTransition();
  const [privyrToken, setPrivyrToken] = useState("");
  const [ringcentralToken, setRingcentralToken] = useState("");

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    startTransition(async () => {
      const result = await getCompanyWebhookTokensAction(companyId);
      if (cancelled || "error" in result) return;
      setPrivyrToken(result.tokens.privyr_webhook);
      setRingcentralToken(result.tokens.ringcentral_webhook);
    });
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  const privyrImportUrl = `${appUrl}/api/integrations/privyr/import`;
  const ringcentralUrl = `${appUrl}/api/webhooks/ringcentral?companyId=${companyId}`;

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
        <h2 className="text-lg font-semibold">Inbound webhooks</h2>
        <p className="text-sm text-muted-foreground">
          Each brand has its own secret. A leaked Zapier token cannot write to
          another company.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Company</Label>
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
        <h3 className="font-semibold">Privyr CSV</h3>
        <p className="text-sm text-muted-foreground">
          POST CSV to this URL with header <code className="text-xs">x-webhook-secret</code>{" "}
          and form field <code className="text-xs">companyId</code>.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <code className="rounded bg-black/30 px-2 py-1 text-xs">{privyrImportUrl}</code>
          <Button size="sm" variant="outline" onClick={() => copy(privyrImportUrl)}>
            <Copy className="h-3 w-3" />
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <code className="max-w-full truncate rounded bg-black/30 px-2 py-1 text-xs">
            {pending && !privyrToken ? "Generating token…" : privyrToken}
          </code>
          <Button
            size="sm"
            variant="outline"
            disabled={!privyrToken}
            onClick={() => copy(privyrToken)}
          >
            <Copy className="h-3 w-3" />
          </Button>
        </div>
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

      <Card className="space-y-4 border-white/5 bg-white/[0.02] p-5">
        <h3 className="font-semibold">Call ingest</h3>
        <p className="text-sm text-muted-foreground">
          Zapier/Make POST to this URL with the brand token as{" "}
          <code className="text-xs">x-webhook-secret</code>.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <code className="rounded bg-black/30 px-2 py-1 text-xs">{ringcentralUrl}</code>
          <Button size="sm" variant="outline" onClick={() => copy(ringcentralUrl)}>
            <Copy className="h-3 w-3" />
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <code className="max-w-full truncate rounded bg-black/30 px-2 py-1 text-xs">
            {pending && !ringcentralToken ? "Generating token…" : ringcentralToken}
          </code>
          <Button
            size="sm"
            variant="outline"
            disabled={!ringcentralToken}
            onClick={() => copy(ringcentralToken)}
          >
            <Copy className="h-3 w-3" />
          </Button>
        </div>
      </Card>
    </section>
  );
}
