"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Clock, Mail, Phone, Plus, Star } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { LeadQuickActions } from "@/components/leads/lead-quick-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createLeadAction } from "@/features/leads/actions";
import type { Lead } from "@/types";
import { cn } from "@/lib/utils";

const statusColors: Record<string, string> = {
  new: "bg-blue-500/20 text-blue-300",
  contacted: "bg-violet-500/20 text-violet-300",
  qualified: "bg-emerald-500/20 text-emerald-300",
};

interface LeadsInboxProps {
  leads: Lead[];
  companyId: string;
  companySlug: string;
  canAdd?: boolean;
}

export function LeadsInbox({
  leads,
  companyId,
  companySlug,
  canAdd = true,
}: LeadsInboxProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const sorted = [...leads].sort((a, b) => {
    if (!a.last_contact_at && b.last_contact_at) return -1;
    if (a.last_contact_at && !b.last_contact_at) return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <div className="space-y-6">
      {canAdd && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/80">
            <Plus className="h-4 w-4" />
            Add lead
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New lead</DialogTitle>
            </DialogHeader>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                startTransition(async () => {
                  const fd = new FormData(e.currentTarget);
                  const result = await createLeadAction(companyId, fd);
                  if (result.error) toast.error(result.error);
                  else {
                    toast.success("Lead added");
                    setOpen(false);
                    router.refresh();
                  }
                });
              }}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="firstName">First name *</Label>
                  <Input id="firstName" name="firstName" required />
                </div>
                <div>
                  <Label htmlFor="lastName">Last name</Label>
                  <Input id="lastName" name="lastName" />
                </div>
              </div>
              <div>
                <Label htmlFor="phone">Phone *</Label>
                <Input id="phone" name="phone" required placeholder="+91..." />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" />
              </div>
              <div>
                <Label htmlFor="source">Source</Label>
                <Input id="source" name="source" placeholder="Facebook, Google, walk-in…" />
              </div>
              <Button type="submit" className="w-full" disabled={pending}>
                Save lead
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      )}

      <div className="space-y-4">
        {sorted.map((lead) => (
          <Card key={lead.id} className="border-white/5 bg-white/[0.02] p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Link
                  href={`/companies/${companySlug}/leads/${lead.id}`}
                  className="font-semibold hover:text-violet-400"
                >
                  {lead.first_name} {lead.last_name}
                </Link>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Badge className={cn(statusColors[lead.status] ?? "bg-white/10")}>
                    {lead.status}
                  </Badge>
                  {lead.source && (
                    <Badge variant="outline" className="text-xs">
                      {lead.source}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 text-amber-400">
                <Star className="h-3.5 w-3.5 fill-current" />
                <span className="text-sm font-medium">{lead.score}</span>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-3 text-sm text-muted-foreground">
              {lead.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {lead.phone}
                </span>
              )}
              {lead.email && (
                <span className="flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  {lead.email}
                </span>
              )}
            </div>
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {lead.last_contact_at
                ? `Last contact ${formatDistanceToNow(new Date(lead.last_contact_at), { addSuffix: true })}`
                : "Awaiting first contact"}
            </p>
            <div className="mt-3 border-t border-white/5 pt-3">
              <LeadQuickActions
                lead={lead}
                companyId={companyId}
                companySlug={companySlug}
              />
            </div>
          </Card>
        ))}
        {sorted.length === 0 && (
          <Card className="border-white/5 p-12 text-center text-muted-foreground">
            No leads yet. Add manually or import from Meta/Google lead ads.
          </Card>
        )}
      </div>
    </div>
  );
}
