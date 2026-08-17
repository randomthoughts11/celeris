"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart3,
  Building2,
  Calendar,
  ChevronDown,
  HardDrive,
  Kanban,
  KeyRound,
  LayoutDashboard,
  Megaphone,
  Menu,
  MessageSquare,
  Phone,
  Settings,
  Share2,
  Shield,
  Target,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { SessionUser } from "@/types";
import {
  getHighestRole,
  hasPermission,
  ROLE_LABELS,
  hasAnyRole,
} from "@/lib/rbac/permissions";
import {
  canSeeCompanyNavItem,
  canSeeGlobalNav,
  isTelecallerFocused,
} from "@/lib/rbac/nav";
import { NotificationsBell } from "@/components/layout/notifications-bell";
import { ClockWidget } from "@/components/workforce/clock-widget";
import { resolveCompanyNameAction } from "@/features/companies/actions";

const companyNav = [
  { key: "overview" as const, href: "", label: "Overview", icon: LayoutDashboard, group: "work" as const },
  { key: "board" as const, href: "/board", label: "Board", icon: Kanban, group: "work" as const },
  { key: "leads" as const, href: "/leads", label: "Inbox", icon: Users, group: "work" as const },
  { key: "calls" as const, href: "/calls", label: "Calls", icon: Phone, group: "work" as const },
  { key: "publish" as const, href: "/publish", label: "Publish", icon: Calendar, group: "work" as const },
  { key: "drive" as const, href: "/drive", label: "Drive", icon: HardDrive, group: "work" as const },
  { key: "social" as const, href: "/social", label: "Social", icon: Share2, group: "work" as const },
  { key: "google-ads" as const, href: "/google-ads", label: "Google Ads", icon: Megaphone, group: "ads" as const },
  { key: "meta-ads" as const, href: "/meta-ads", label: "Meta Ads", icon: Target, group: "ads" as const },
  { key: "analytics" as const, href: "/analytics", label: "Analytics", icon: BarChart3, group: "ads" as const },
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

function NavChip({
  href,
  active,
  icon: Icon,
  label,
}: {
  href: string;
  active: boolean;
  icon: typeof LayoutDashboard;
  label: string;
}) {
  return (
    <Link href={href}>
      <span
        className={cn(
          "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors",
          active
            ? "bg-white/10 text-foreground"
            : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
        )}
      >
        <Icon className="h-3.5 w-3.5" />
        {label}
      </span>
    </Link>
  );
}

export function AppShell({ user, children }: AppShellProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const telecallerMode = isTelecallerFocused(user.roles);
  const homeHref = telecallerMode ? "/telecaller" : "/";
  const isHome = pathname === "/" || pathname === "/telecaller";
  const companySlug = pathname.match(/^\/companies\/([^/]+)/)?.[1];
  const [companyName, setCompanyName] = useState<string | undefined>(
    companySlug ? formatSlugAsName(companySlug) : undefined
  );
  const basePath = companySlug ? `/companies/${companySlug}` : "";
  const showAdmin = hasPermission(user.roles, "MANAGE_USERS");
  const showTeam = hasAnyRole(user.roles, ["god_mode", "admin", "manager"]);
  const roleLabel =
    user.roles.length > 0
      ? ROLE_LABELS[getHighestRole(user.roles)]
      : "Pending role";

  useEffect(() => {
    if (!companySlug) {
      setCompanyName(undefined);
      return;
    }
    setCompanyName(formatSlugAsName(companySlug));
    let cancelled = false;
    void resolveCompanyNameAction(companySlug).then((name) => {
      if (!cancelled && name) setCompanyName(name);
    });
    return () => {
      cancelled = true;
    };
  }, [companySlug]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const visibleCompanyNav = companyNav.filter((item) =>
    canSeeCompanyNavItem(user.roles, item.key)
  );
  const workNav = visibleCompanyNav.filter((item) => item.group === "work");
  const adsNav = visibleCompanyNav.filter((item) => item.group === "ads");

  const globalNav = [
    {
      key: "home" as const,
      href: homeHref,
      label: telecallerMode ? "Desk" : "Brands",
      icon: Building2,
    },
    { key: "chat" as const, href: "/chat", label: "Chat", icon: MessageSquare },
    { key: "vault" as const, href: "/vault", label: "Vault", icon: KeyRound },
    ...(showTeam
      ? [{ key: "team" as const, href: "/team", label: "Team", icon: Users }]
      : []),
    { key: "settings" as const, href: "/settings", label: "Settings", icon: Settings },
    ...(showAdmin
      ? [{ key: "admin" as const, href: "/admin", label: "Admin", icon: Shield }]
      : []),
  ].filter(
    (item) => item.key === "home" || canSeeGlobalNav(user.roles, item.key)
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-1/4 top-0 h-[500px] w-[500px] rounded-full bg-violet-600/10 blur-[120px]" />
        <div className="absolute -right-1/4 top-1/3 h-[400px] w-[400px] rounded-full bg-blue-600/10 blur-[100px]" />
        <div className="absolute bottom-0 left-1/3 h-[300px] w-[300px] rounded-full bg-emerald-600/5 blur-[80px]" />
      </div>

      <header className="sticky top-0 z-50 border-b border-white/5 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3 sm:gap-5">
            <button
              type="button"
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-white/5 hover:text-foreground md:hidden"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              onClick={() => setMenuOpen((o) => !o)}
            >
              {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>

            <Link href={homeHref} className="flex shrink-0 items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-blue-600">
                <span className="text-sm font-bold text-white">A</span>
              </div>
              <span className="hidden font-semibold tracking-tight sm:inline">
                Agency OS
              </span>
            </Link>

            {companySlug && companyName && (
              <Link
                href={homeHref}
                className="hidden min-w-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 lg:flex"
                title="Switch brand"
              >
                <Building2 className="h-3.5 w-3.5 shrink-0 text-violet-400" />
                <span className="max-w-[200px] truncate text-sm font-medium">
                  {companyName}
                </span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </Link>
            )}

            <nav className="hidden items-center gap-0.5 md:flex">
              {globalNav.map((item) => {
                const active =
                  item.href === homeHref
                    ? isHome
                    : pathname.startsWith(item.href);
                return (
                  <NavChip
                    key={item.href}
                    href={item.href}
                    active={active}
                    icon={item.icon}
                    label={item.label}
                  />
                );
              })}
            </nav>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <ClockWidget />
            <NotificationsBell userId={user.id} />

            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium leading-none">{user.fullName}</p>
              <p className="mt-1 text-xs text-violet-400">{roleLabel}</p>
            </div>

            <UserButton
              appearance={{
                elements: { avatarBox: "h-8 w-8" },
              }}
            />
          </div>
        </div>

        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-t border-white/5 md:hidden"
            >
              <nav className="mx-auto flex max-w-[1600px] flex-col gap-1 px-4 py-3">
                {globalNav.map((item) => {
                  const Icon = item.icon;
                  const active =
                    item.href === homeHref
                      ? isHome
                      : pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm",
                        active
                          ? "bg-white/10 text-foreground"
                          : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  );
                })}
                {companySlug && (
                  <>
                    <p className="mt-3 px-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      {companyName ?? "This brand"}
                    </p>
                    {visibleCompanyNav.map((item) => {
                      const href = `${basePath}${item.href}`;
                      const Icon = item.icon;
                      const active =
                        item.href === ""
                          ? pathname === basePath
                          : pathname.startsWith(href);
                      return (
                        <Link
                          key={item.href}
                          href={href}
                          className={cn(
                            "flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm",
                            active
                              ? "bg-white/10 text-foreground"
                              : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                          )}
                        >
                          <Icon className="h-4 w-4" />
                          {item.label}
                        </Link>
                      );
                    })}
                  </>
                )}
              </nav>
            </motion.div>
          )}
        </AnimatePresence>

        {companySlug && visibleCompanyNav.length > 0 && (
          <div className="border-t border-white/5">
            <div className="mx-auto flex max-w-[1600px] items-center gap-4 overflow-x-auto px-4 py-2 sm:px-6">
              <CompanyTabGroup
                label="Work"
                items={workNav}
                basePath={basePath}
                pathname={pathname}
              />
              {adsNav.length > 0 && (
                <CompanyTabGroup
                  label="Ads"
                  items={adsNav}
                  basePath={basePath}
                  pathname={pathname}
                />
              )}
            </div>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}

function CompanyTabGroup({
  label,
  items,
  basePath,
  pathname,
}: {
  label: string;
  items: typeof companyNav;
  basePath: string;
  pathname: string;
}) {
  if (items.length === 0) return null;
  return (
    <div className="flex shrink-0 items-center gap-1">
      <span className="mr-1 hidden text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70 sm:inline">
        {label}
      </span>
      {items.map((item) => {
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
    </div>
  );
}
