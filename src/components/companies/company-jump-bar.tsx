import Link from "next/link";
import {
  BarChart3,
  Calendar,
  HardDrive,
  Kanban,
  Phone,
  Users,
} from "lucide-react";
import type { UserRole } from "@/types";
import { canSeeCompanyNavItem, type CompanyNavItem } from "@/lib/rbac/nav";
import { cn } from "@/lib/utils";

interface CompanyJumpBarProps {
  slug: string;
  roles: UserRole[];
  openTasks?: number;
  leadsCount?: number;
}

const TILES: {
  key: CompanyNavItem;
  href: string;
  label: string;
  hint: string;
  icon: typeof Kanban;
}[] = [
  { key: "board", href: "/board", label: "Board", hint: "Work in motion", icon: Kanban },
  { key: "leads", href: "/leads", label: "Inbox", hint: "Leads to contact", icon: Users },
  { key: "publish", href: "/publish", label: "Publish", hint: "Post on platforms", icon: Calendar },
  { key: "calls", href: "/calls", label: "Calls", hint: "Log a conversation", icon: Phone },
  { key: "drive", href: "/drive", label: "Drive", hint: "Files & assets", icon: HardDrive },
  { key: "analytics", href: "/analytics", label: "Analytics", hint: "Performance hub", icon: BarChart3 },
];

export function CompanyJumpBar({
  slug,
  roles,
  openTasks,
  leadsCount,
}: CompanyJumpBarProps) {
  const visible = TILES.filter((tile) => canSeeCompanyNavItem(roles, tile.key));
  if (visible.length === 0) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {visible.map((tile) => {
        const Icon = tile.icon;
        const extra =
          tile.key === "board" && openTasks != null
            ? `${openTasks} open`
            : tile.key === "leads" && leadsCount != null
              ? `${leadsCount} leads`
              : tile.hint;
        return (
          <Link
            key={tile.key}
            href={`/companies/${slug}${tile.href}`}
            className={cn(
              "group flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.03] p-4",
              "transition-colors hover:border-white/15 hover:bg-white/[0.06]"
            )}
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300">
              <Icon className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{tile.label}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {extra}
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
