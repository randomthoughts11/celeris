"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SyncCompanyButton } from "@/components/companies/sync-company-button";
import { openCompanyChatAction } from "@/features/chat/actions";

export function CompanyHeaderActions({ companyId }: { companyId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const openChat = () => {
    startTransition(async () => {
      const result = await openCompanyChatAction(companyId);
      router.push(`/chat?room=${result.roomId}`);
    });
  };

  return (
    <div className="flex flex-wrap gap-2">
      <SyncCompanyButton companyId={companyId} />
      <Button variant="outline" size="sm" className="gap-2" onClick={openChat} disabled={pending}>
        <MessageSquare className="h-3.5 w-3.5" />
        Team chat
      </Button>
    </div>
  );
}
