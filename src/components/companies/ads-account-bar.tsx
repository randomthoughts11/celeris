"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  fetchAdAccountsAction,
  linkAdAccountAction,
} from "@/features/companies/actions";
import { SyncCompanyButton } from "@/components/companies/sync-company-button";
import type { AgencyAdAccount } from "@/types";

interface AdsAccountBarProps {
  companyId: string;
  provider: "google_ads" | "meta_ads";
  agencyConnected: boolean;
  linkedAccountName?: string;
  lastSyncedAt?: string | null;
  canManage: boolean;
  canSync: boolean;
}

export function AdsAccountBar({
  companyId,
  provider,
  agencyConnected,
  linkedAccountName,
  lastSyncedAt,
  canManage,
  canSync,
}: AdsAccountBarProps) {
  const router = useRouter();
  const [accounts, setAccounts] = useState<AgencyAdAccount[]>([]);
  const [selected, setSelected] = useState("");
  const [pending, startTransition] = useTransition();
  const label = provider === "google_ads" ? "Google Ads" : "Meta Ads";

  useEffect(() => {
    if (!canManage || !agencyConnected) return;
    void fetchAdAccountsAction().then((data) => {
      setAccounts(provider === "google_ads" ? data.google : data.meta);
    });
  }, [canManage, agencyConnected, provider]);

  const link = () => {
    const account = accounts.find((a) => a.id === selected);
    if (!account) {
      toast.error("Pick an ad account");
      return;
    }
    startTransition(async () => {
      const result = await linkAdAccountAction(
        companyId,
        provider,
        account.id,
        account.name
      );
      if (result && "error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      if (result && "warning" in result && result.warning) {
        toast.warning(result.warning);
      } else {
        toast.success(`${label} linked and synced`);
      }
      router.refresh();
    });
  };

  if (!agencyConnected) {
    return (
      <Card className="border-amber-500/20 bg-amber-500/5 p-5">
        <p className="font-medium">Connect {label} once for the agency</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Settings → connect {label}. Then come back here and pick this brand’s
          account.
        </p>
        {canManage && (
          <Link href="/settings" className="mt-3 inline-block">
            <Button size="sm">Open Settings</Button>
          </Link>
        )}
      </Card>
    );
  }

  return (
    <Card className="flex flex-wrap items-end justify-between gap-4 border-white/8 bg-white/[0.03] p-5">
      <div className="min-w-0 space-y-3">
        {linkedAccountName ? (
          <div>
            <p className="text-xs text-muted-foreground">Linked account</p>
            <p className="font-medium">{linkedAccountName}</p>
            {lastSyncedAt && (
              <p className="mt-1 text-xs text-muted-foreground">
                Last sync {new Date(lastSyncedAt).toLocaleString()}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Pick the {label} account for this brand, then sync.
          </p>
        )}
        {canManage && (
          <div className="flex flex-wrap items-center gap-2">
            <Select value={selected} onValueChange={(v) => setSelected(v ?? "")}>
              <SelectTrigger className="w-[260px]">
                <SelectValue
                  placeholder={
                    linkedAccountName ? "Switch account" : "Select ad account"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={link} disabled={pending || !selected}>
              {pending ? "Linking…" : linkedAccountName ? "Switch & sync" : "Link & sync"}
            </Button>
          </div>
        )}
      </div>
      {canSync && linkedAccountName && <SyncCompanyButton companyId={companyId} />}
    </Card>
  );
}
