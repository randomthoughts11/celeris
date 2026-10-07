"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import {
  BarChart3,
  BookOpen,
  Bot,
  Building2,
  Calendar,
  ChevronRight,
  GitBranch,
  HardDrive,
  Inbox,
  Kanban,
  KeyRound,
  LayoutDashboard,
  ListChecks,
  MapPin,
  Megaphone,
  Menu,
  MessageSquare,
  Phone,
  PhoneCall,
  Send,
  Settings,
  Share2,
  Shield,
  Target,
  UserCircle2,
  Users,
  Workflow,
  X,
  Zap,
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
  isDeskFocused,
  type GlobalNavItem,
} from "@/lib/rbac/nav";
import { NotificationsBell } from "@/components/layout/notifications-bell";
import { ClockWidget } from "@/components/workforce/clock-widget";
import { resolveCompanyNameAction } from "@/features/companies/actions";
import { CLIENT_BRAND_PAGES } from "@/lib/call-audit/access";

const companyNav = [
  { key: "overview" as const, href: "", label: "Overview", icon: LayoutDashboard, group: "work" as const },
  { key: "board" as const, href: "/board", label: "Board", icon: Kanban, group: "work" as const },
  { key: "leads" as const, href: "/leads", label: "Leads", icon: Users, group: "crm" as const },
  { key: "pipeline" as const, href: "/pipeline", label: "Pipeline", icon: GitBranch, group: "crm" as const },
  { key: "customers" as const, href: "/customers", label: "Customers", icon: UserCircle2, group: "crm" as const },
  { key: "appointments" as const, href: "/appointments", label: "Bookings", icon: Calendar, group: "crm" as const },
  { key: "calls" as const, href: "/calls", label: "Calls", icon: Phone, group: "crm" as const },
  { key: "ai-calls" as const, href: "/ai-calls", label: "AI Calls", icon: Bot, group: "crm" as const },
  { key: "messages" as const, href: "/messages", label: "Messages", icon: Inbox, group: "crm" as const },
  { key: "branches" as const, href: "/branches", label: "Branches", icon: MapPin, group: "ops" as const },
  { key: "knowledge" as const, href: "/knowledge", label: "Knowledge", icon: BookOpen, group: "ops" as const },
  { key: "automations" as const, href: "/automations", label: "Automations", icon: Workflow, group: "ops" as const },
  { key: "dashboards" as const, href: "/dashboards", label: "Dashboards", icon: Zap, group: "ops" as const },
  { key: "publish" as const, href: "/publish", label: "Publish", icon: Calendar, group: "work" as const },
  { key: "drive" as const, href: "/drive", label: "Drive", icon: HardDrive, group: "work" as const },
  { key: "social" as const, href: "/social", label: "Social", icon: Share2, group: "work" as const },
  { key: "google-ads" as const, href: "/google-ads", label: "Google Ads", icon: Megaphone, group: "ads" as const },
  { key: "meta-ads" as const, href: "/meta-ads", label: "Meta Ads", icon: Target, group: "ads" as const },
  { key: "analytics" as const, href: "/analytics", label: "Analytics", icon: BarChart3, group: "ads" as const },
];

const companyGroups = [
  { id: "work", label: "Work" },
  { id: "crm", label: "CRM" },
  { id: "ops", label: "Operations" },
  { id: "ads", label: "Advertising" },
] as const;

interface AppShellProps {
  user: SessionUser;
  showCallAudit?: boolean;
  /** Set for brand clients: they see only these brands' ad pages (plus the call audit if allowed). */
  clientBrands?: Array<{ slug: string; name: string }>;
  children: React.ReactNode;
}

function formatSlugAsName(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function SideLink({
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
    <Link
      href={href}
      className={cn(
        "relative flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
        active
          ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-primary"
          : "text-sidebar-foreground/80 hover:bg-muted hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function SideSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="px-2.5 pb-1 pt-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      {children}
    </div>
  );
}

export function AppShell({ user, showCallAudit, clientBrands, children }: AppShellProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const telecallerMode = isDeskFocused(user.roles);
  const client = Boolean(clientBrands);
  const clientHome = showCallAudit || !clientBrands?.[0] ? "/call-audit" : `/companies/${clientBrands[0].slug}/meta-ads`;
  const homeHref = client ? clientHome : telecallerMode ? "/telecaller" : "/";
  const homeLabel = client ? (showCallAudit ? "Call audit" : "Ads") : telecallerMode ? "Desk" : "Brands";
  const isHome = pathname === homeHref || pathname === "/" || pathname === "/telecaller";
  const companySlug = pathname.match(/^\/companies\/([^/]+)/)?.[1];
  const [resolvedName, setResolvedName] = useState<{ slug: string; name: string }>();
  const companyName = companySlug
    ? resolvedName?.slug === companySlug
      ? resolvedName.name
      : formatSlugAsName(companySlug)
    : undefined;
  const basePath = companySlug ? `/companies/${companySlug}` : "";
  const showAdmin = hasPermission(user.roles, "MANAGE_USERS");
  const showTeam = hasAnyRole(user.roles, ["god_mode", "admin", "manager"]);
  const roleLabel =
    user.roles.length > 0
      ? ROLE_LABELS[getHighestRole(user.roles)]
      : "Pending role";

  useEffect(() => {
    if (!companySlug) return;
    let cancelled = false;
    void resolveCompanyNameAction(companySlug).then((name) => {
      if (!cancelled && name) setResolvedName({ slug: companySlug, name });
    });
    return () => {
      cancelled = true;
    };
  }, [companySlug]);

  const visibleCompanyNav = companyNav.filter((item) =>
    client
      ? (CLIENT_BRAND_PAGES as readonly string[]).includes(item.key)
      : canSeeCompanyNavItem(user.roles, item.key)
  );

  const globalNav = client
    ? [
        ...(showCallAudit ? [{ key: "call-audit" as const, href: "/call-audit", label: "Call audit", icon: PhoneCall }] : []),
        ...clientBrands!.map((b) => ({ key: "home" as const, href: `/companies/${b.slug}/meta-ads`, label: b.name, icon: Building2 })),
      ]
    : [
    {
      key: "home" as const,
      href: homeHref,
      label: homeLabel,
      icon: Building2,
    },
    { key: "tasks" as const, href: "/tasks", label: "Tasks", icon: ListChecks },
    { key: "call-audit" as const, href: "/call-audit", label: "Call audit", icon: PhoneCall },
    { key: "inbox" as const, href: "/inbox", label: "Inbox", icon: Inbox },
    { key: "dashboards" as const, href: "/dashboards", label: "Dashboards", icon: Zap },
    { key: "knowledge" as const, href: "/knowledge", label: "Knowledge", icon: BookOpen },
    { key: "ai-performance" as const, href: "/ai-performance", label: "AI Performance", icon: Bot },
    { key: "chat" as const, href: "/chat", label: "Chat", icon: MessageSquare },
    { key: "drops" as const, href: "/drops", label: "Drop", icon: Send },
    { key: "vault" as const, href: "/vault", label: "Vault", icon: KeyRound },
    ...(showTeam
      ? [{ key: "team" as const, href: "/team", label: "Team", icon: Users }]
      : []),
    { key: "settings" as const, href: "/settings", label: "Settings", icon: Settings },
    ...(showAdmin
      ? [{ key: "admin" as const, href: "/admin", label: "Admin", icon: Shield }]
      : []),
  ].filter(
    (item) =>
      item.key === "home" ||
      (item.key === "call-audit" ? showCallAudit : canSeeGlobalNav(user.roles, item.key as GlobalNavItem))
  );

  const currentLabel =
    visibleCompanyNav.find((item) =>
      item.href === "" ? pathname === basePath : pathname.startsWith(`${basePath}${item.href}`)
    )?.label ??
    globalNav.find((item) => item.href !== homeHref && pathname.startsWith(item.href))?.label;

  const sidebar = (
    <nav className="flex h-full flex-col overflow-y-auto px-3 pb-4">
      <SideSection label="Workspace">
        {globalNav.map((item) => (
          <SideLink
            key={item.href}
            href={item.href}
            active={item.href === homeHref ? isHome : pathname.startsWith(item.href)}
            icon={item.icon}
            label={item.label}
          />
        ))}
      </SideSection>

      {companySlug &&
        companyGroups.map((group) => {
          const items = visibleCompanyNav.filter((i) => i.group === group.id);
          if (items.length === 0) return null;
          return (
            <SideSection key={group.id} label={group.label}>
              {items.map((item) => {
                const href = `${basePath}${item.href}`;
                return (
                  <SideLink
                    key={item.key}
                    href={href}
                    active={item.href === "" ? pathname === basePath : pathname.startsWith(href)}
                    icon={item.icon}
                    label={item.label}
                  />
                );
              })}
            </SideSection>
          );
        })}
    </nav>
  );

  const brandSwitcher = companySlug && companyName && (
    <Link
      href={homeHref}
      className="mx-3 mt-3 flex items-center gap-2.5 rounded-md border bg-card px-2.5 py-2 hover:bg-muted"
      title="Switch brand"
    >
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-primary/10 text-xs font-semibold text-primary">
        {companyName.charAt(0)}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium leading-tight">{companyName}</p>
        <p className="text-[11px] text-muted-foreground">Brand · switch</p>
      </div>
    </Link>
  );

  const logo = (
    <Link href={homeHref} className="flex items-center gap-2">
      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary">
        <span className="text-sm font-bold text-primary-foreground">C</span>
      </div>
      <span className="font-semibold tracking-tight">Celeris CRM</span>
    </Link>
  );

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r bg-sidebar md:flex">
        <div className="flex h-14 shrink-0 items-center border-b px-4">{logo}</div>
        {brandSwitcher}
        {sidebar}
      </aside>

      {menuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-foreground/20" onClick={() => setMenuOpen(false)} />
          <aside
            className="absolute inset-y-0 left-0 flex w-64 flex-col border-r bg-sidebar shadow-xl"
            onClick={(e) => {
              if ((e.target as HTMLElement).closest("a")) setMenuOpen(false);
            }}
          >
            <div className="flex h-14 shrink-0 items-center justify-between border-b px-4">
              {logo}
              <button
                type="button"
                aria-label="Close menu"
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
                onClick={() => setMenuOpen(false)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {brandSwitcher}
            {sidebar}
          </aside>
        </div>
      )}

      <div className="md:pl-60">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b bg-background/95 px-4 backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted md:hidden"
              aria-label="Open menu"
              onClick={() => setMenuOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </button>
            <nav className="flex min-w-0 items-center gap-1 text-sm text-muted-foreground">
              <Link href={homeHref} className="hover:text-foreground">
                {homeLabel}
              </Link>
              {companySlug && companyName && (
                <>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                  <Link href={basePath} className="truncate hover:text-foreground">
                    {companyName}
                  </Link>
                </>
              )}
              {currentLabel && (
                <>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate font-medium text-foreground">{currentLabel}</span>
                </>
              )}
            </nav>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {!client && <ClockWidget />}
            <NotificationsBell userId={user.id} />
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium leading-none">{user.fullName}</p>
              <p className="mt-1 text-xs text-muted-foreground">{roleLabel}</p>
            </div>
            <UserButton appearance={{ elements: { avatarBox: "h-8 w-8" } }} />
          </div>
        </header>

        <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
