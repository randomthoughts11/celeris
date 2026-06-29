"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { motion } from "framer-motion";
import {
  BarChart3,
  Bell,
  Building2,
  Calendar,
  LayoutDashboard,
  Megaphone,
  Phone,
  Share2,
  Target,
  CheckSquare,
  HardDrive,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { SessionUser } from "@/types";
import { ROLE_LABELS } from "@/lib/rbac/permissions";

const companyNav = [
  { href: "", label: "Overview", icon: LayoutDashboard },
  { href: "/google-ads", label: "Google Ads", icon: Megaphone },
  { href: "/meta-ads", label: "Meta Ads", icon: Target },
  { href: "/social", label: "Social", icon: Share2 },
  { href: "/scheduler", label: "Scheduler", icon: Calendar },
  { href: "/drive", label: "Drive", icon: HardDrive },
  { href: "/leads", label: "Leads", icon: Building2 },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/ringcentral", label: "Calls", icon: Phone },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
];

interface AppShellProps {
  user: SessionUser;
  children: React.ReactNode;
}

function formatSlugAsName(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function AppShell({ user, children }: AppShellProps) {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const companySlug = pathname.match(/^\/companies\/([^/]+)/)?.[1];
  const companyName = companySlug ? formatSlugAsName(companySlug) : undefined;
  const basePath = companySlug ? `/companies/${companySlug}` : "";

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-1/4 top-0 h-[500px] w-[500px] rounded-full bg-violet-600/10 blur-[120px]" />
        <div className="absolute -right-1/4 top-1/3 h-[400px] w-[400px] rounded-full bg-blue-600/10 blur-[100px]" />
        <div className="absolute bottom-0 left-1/3 h-[300px] w-[300px] rounded-full bg-emerald-600/5 blur-[80px]" />
      </div>

      <header className="sticky top-0 z-50 border-b border-white/5 bg-background/60 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between px-6">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-blue-600">
                <span className="text-sm font-bold text-white">A</span>
              </div>
              <span className="hidden font-semibold tracking-tight sm:inline">
                Agency OS
              </span>
            </Link>

            {!isHome && companySlug && (
              <nav className="hidden items-center gap-1 lg:flex">
                <Link
                  href="/"
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  Companies
                </Link>
                <span className="text-muted-foreground/50">/</span>
                <span className="text-sm font-medium">{companyName}</span>
              </nav>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-4 w-4" />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-violet-500" />
            </Button>

            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium leading-none">{user.fullName}</p>
              <p className="mt-1 text-xs text-violet-400">
                {ROLE_LABELS[user.roles[0]]}
              </p>
            </div>

            <UserButton
              appearance={{
                elements: {
                  avatarBox: "h-8 w-8",
                },
              }}
            />
          </div>
        </div>

        {companySlug && (
          <div className="border-t border-white/5">
            <div className="mx-auto max-w-[1600px] overflow-x-auto px-6">
              <nav className="flex gap-1 py-2">
                {companyNav.map((item) => {
                  const href = `${basePath}${item.href}`;
                  const isActive =
                    item.href === ""
                      ? pathname === basePath
                      : pathname.startsWith(href);
                  const Icon = item.icon;

                  return (
                    <Link key={item.href} href={href}>
                      <motion.span
                        className={cn(
                          "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors",
                          isActive
                            ? "bg-white/10 text-foreground"
                            : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                        )}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {item.label}
                      </motion.span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-[1600px] px-6 py-8">{children}</main>
    </div>
  );
}
