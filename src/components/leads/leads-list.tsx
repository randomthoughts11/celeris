"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Clock, Mail, Phone, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";
import type { Lead } from "@/types";
import { cn } from "@/lib/utils";

const statusColors: Record<string, string> = {
  new: "bg-blue-500/20 text-blue-300",
  contacted: "bg-violet-500/20 text-violet-300",
  qualified: "bg-emerald-500/20 text-emerald-300",
  proposal: "bg-amber-500/20 text-amber-300",
  negotiation: "bg-orange-500/20 text-orange-300",
  won: "bg-green-500/20 text-green-300",
  lost: "bg-red-500/20 text-red-300",
  nurture: "bg-gray-500/20 text-gray-300",
};

const priorityColors: Record<string, string> = {
  urgent: "border-red-500/50",
  high: "border-amber-500/50",
  medium: "border-white/10",
  low: "border-white/5",
};

interface LeadsListProps {
  leads: Lead[];
  companySlug: string;
}

export function LeadsList({ leads, companySlug }: LeadsListProps) {
  if (leads.length === 0) {
    return (
      <Card className="border-white/5 bg-white/[0.02] p-12 text-center">
        <p className="text-muted-foreground">No leads yet</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {leads.map((lead, i) => (
        <motion.div
          key={lead.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
        >
          <Link href={`/companies/${companySlug}/leads/${lead.id}`}>
            <Card
              className={cn(
                "border bg-white/[0.02] p-4 backdrop-blur-sm transition-colors hover:bg-white/[0.04]",
                priorityColors[lead.priority]
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">
                      {lead.first_name} {lead.last_name}
                    </h3>
                    <Badge className={statusColors[lead.status]}>
                      {lead.status}
                    </Badge>
                    {lead.priority === "urgent" && (
                      <Badge variant="destructive">Urgent</Badge>
                    )}
                  </div>
                  {lead.company_name && (
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {lead.company_name}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 text-amber-400">
                  <Star className="h-3.5 w-3.5 fill-current" />
                  <span className="text-sm font-medium">{lead.score}</span>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
                {lead.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    {lead.email}
                  </span>
                )}
                {lead.phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" />
                    {lead.phone}
                  </span>
                )}
                {lead.source && (
                  <span className="rounded bg-white/5 px-2 py-0.5 text-xs">
                    {lead.source}
                  </span>
                )}
              </div>

              <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {lead.last_contact_at
                  ? `Last contact ${formatDistanceToNow(new Date(lead.last_contact_at), { addSuffix: true })}`
                  : `Created ${formatDistanceToNow(new Date(lead.created_at), { addSuffix: true })} · No contact yet`}
              </div>

              {lead.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {lead.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </Card>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}
