"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { syncCompanyDataAction } from "@/features/companies/actions";

export function SyncCompanyButton({ companyId }: { companyId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-2"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          try {
            await syncCompanyDataAction(companyId);
            toast.success("Data synced from Google & Meta");
            router.refresh();
          } catch {
            toast.error("Sync failed — check Settings integrations");
          }
        })
      }
    >
      <RefreshCw className={cn("h-3.5 w-3.5", pending && "animate-spin")} />
      Sync data
    </Button>
  );
}
