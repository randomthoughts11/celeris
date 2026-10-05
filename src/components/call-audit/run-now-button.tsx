"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { runCallAuditAction } from "@/features/call-audit/actions";

export function RunNowButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await runCallAuditAction();
          if ("error" in res && res.error) toast.error(res.error);
          else router.push(`/call-audit?run=${res.runId}`);
        })
      }
    >
      {pending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1.5 h-4 w-4" />}
      {pending ? "Checking…" : "Re-run latest window"}
    </Button>
  );
}
