"use client";

import Link from "next/link";
import { HardDrive, Link2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { DriveStatus } from "@/features/drive/queries";

interface SettingsIntegrationsProps {
  companies: {
    companyId: string;
    slug: string;
    name: string;
    drive: DriveStatus;
  }[];
  googleConfigured: boolean;
}

export function SettingsIntegrations({
  companies,
  googleConfigured,
}: SettingsIntegrationsProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Google Drive</h2>
      {!googleConfigured && (
        <Card className="border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-400">
          Configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Vercel to
          enable Drive.
        </Card>
      )}
      {companies.map((c) => (
        <Card
          key={c.companyId}
          className="flex flex-wrap items-center justify-between gap-4 border-white/5 bg-white/[0.02] p-4"
        >
          <div className="flex items-center gap-3">
            <HardDrive className="h-4 w-4 text-blue-400" />
            <div>
              <p className="font-medium">{c.name}</p>
              <p className="text-xs text-muted-foreground">
                {c.drive.connected
                  ? c.drive.connectedEmail ?? "Connected"
                  : "Not connected"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={c.drive.connected ? "default" : "outline"}>
              {c.drive.connected ? "Connected" : "Disconnected"}
            </Badge>
            {c.drive.connected ? (
              <Link
                href={`/companies/${c.slug}/drive`}
                className="inline-flex h-7 items-center rounded-lg border border-border px-2.5 text-sm hover:bg-muted"
              >
                Manage files
              </Link>
            ) : googleConfigured ? (
              <a
                href={`/api/integrations/google-drive/connect?companyId=${c.companyId}`}
                className="inline-flex h-7 items-center gap-1 rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/80"
              >
                <Link2 className="h-3 w-3" />
                Connect
              </a>
            ) : null}
          </div>
        </Card>
      ))}
    </div>
  );
}
