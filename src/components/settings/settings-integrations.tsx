"use client";

import Link from "next/link";
import { HardDrive, Link2, Megaphone, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  googleConfigHint?: string;
  metaConfigured: boolean;
  googleConnected: boolean;
  metaConnected: boolean;
  driveConfigured: boolean;
}

export function SettingsIntegrations({
  companies,
  googleConfigured,
  googleConfigHint,
  metaConfigured,
  googleConnected,
  metaConnected,
}: SettingsIntegrationsProps) {
  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Agency accounts</h2>
        <p className="text-sm text-muted-foreground">
          Connect once at the agency level. When you create a company, you pick
          which Google Ads and Meta ad accounts belong to that brand.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="border-white/5 bg-white/[0.02] p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <Megaphone className="h-5 w-5 text-blue-400" />
                <div>
                  <p className="font-medium">Google (Ads + Drive)</p>
                  <p className="text-xs text-muted-foreground">
                    Lists ad accounts &amp; auto-creates Drive folders
                  </p>
                </div>
              </div>
              <Badge variant={googleConnected ? "default" : "outline"}>
                {googleConnected ? "Connected" : "Not connected"}
              </Badge>
            </div>
            {googleConfigured ? (
              <a href="/api/integrations/google/connect" className="mt-4 inline-block">
                <Button size="sm" className="gap-2">
                  <Link2 className="h-3 w-3" />
                  {googleConnected ? "Reconnect Google" : "Connect Google"}
                </Button>
              </a>
            ) : (
              <p className="mt-3 text-xs text-amber-400">{googleConfigHint}</p>
            )}
          </Card>

          <Card className="border-white/5 bg-white/[0.02] p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <Target className="h-5 w-5 text-indigo-400" />
                <div>
                  <p className="font-medium">Meta (Ads + Social)</p>
                  <p className="text-xs text-muted-foreground">
                    Lists ad accounts &amp; links Facebook/Instagram pages
                  </p>
                </div>
              </div>
              <Badge variant={metaConnected ? "default" : "outline"}>
                {metaConnected ? "Connected" : "Not connected"}
              </Badge>
            </div>
            {metaConfigured ? (
              <a href="/api/integrations/meta/connect" className="mt-4 inline-block">
                <Button size="sm" className="gap-2">
                  <Link2 className="h-3 w-3" />
                  {metaConnected ? "Reconnect Meta" : "Connect Meta"}
                </Button>
              </a>
            ) : (
              <p className="mt-3 text-xs text-amber-400">
                Set META_APP_ID and META_APP_SECRET
              </p>
            )}
          </Card>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Per-company Drive</h2>
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
                    ? c.drive.connectedEmail ?? "Agency Drive — folders ready"
                    : "Folders created when company is added (requires Google connected above)"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={c.drive.connected ? "default" : "outline"}>
                {c.drive.connected ? "Ready" : "Pending"}
              </Badge>
              {c.drive.connected && (
                <Link
                  href={`/companies/${c.slug}/drive`}
                  className="inline-flex h-7 items-center rounded-lg border border-border px-2.5 text-sm hover:bg-muted"
                >
                  Manage files
                </Link>
              )}
            </div>
          </Card>
        ))}
      </section>
    </div>
  );
}
