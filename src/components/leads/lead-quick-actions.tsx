"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, Phone, PhoneOutgoing, StickyNote } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  addLeadActivityAction,
  updateLeadStatusAction,
} from "@/features/leads/actions";
import type { Lead } from "@/types";

interface LeadQuickActionsProps {
  lead: Lead;
  companyId: string;
  companySlug: string;
}

/** Privyr-style one-tap actions — native CRM, no third-party RPA. */
export function LeadQuickActions({
  lead,
  companyId,
  companySlug,
}: LeadQuickActionsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const phone = lead.phone?.replace(/\D/g, "");
  const waPhone = phone?.startsWith("91") ? phone : phone ? `91${phone}` : null;

  const logActivity = (
    type: string,
    title: string,
    description: string,
    status?: "contacted"
  ) => {
    startTransition(async () => {
      await addLeadActivityAction(lead.id, companyId, title, description, type);
      if (status) await updateLeadStatusAction(lead.id, companyId, status);
      toast.success("Logged");
      router.refresh();
    });
  };

  return (
    <div className="flex flex-wrap gap-2">
      {phone && (
        <>
          <a
            href={`tel:${lead.phone}`}
            className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-border px-2.5 text-sm hover:bg-muted"
          >
            <Phone className="h-3.5 w-3.5" />
            Call
          </a>
          {waPhone && (
            <a
              href={`https://wa.me/${waPhone}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-border px-2.5 text-sm hover:bg-muted"
              onClick={() =>
                logActivity("whatsapp", "WhatsApp opened", "Quick action from lead inbox")
              }
            >
              <MessageCircle className="h-3.5 w-3.5" />
              WhatsApp
            </a>
          )}
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={pending}
            onClick={() =>
              router.push(
                `/companies/${companySlug}/ringcentral?log=${lead.id}&phone=${encodeURIComponent(lead.phone ?? "")}`
              )
            }
          >
            <PhoneOutgoing className="h-3.5 w-3.5" />
            Log call
          </Button>
        </>
      )}
      <Button
        size="sm"
        variant="secondary"
        className="gap-1.5"
        disabled={pending}
        onClick={() =>
          logActivity("note", "Quick note", "Marked contacted from inbox", "contacted")
        }
      >
        <StickyNote className="h-3.5 w-3.5" />
        Mark contacted
      </Button>
    </div>
  );
}
