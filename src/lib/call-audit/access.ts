/** Only the emails in CALL_AUDIT_VIEWERS can see the call audit, whatever their role. */
export function callAuditViewers(): string[] {
  return (process.env.CALL_AUDIT_VIEWERS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function canViewCallAudit(user: { email: string } | null | undefined): boolean {
  return Boolean(user?.email) && callAuditViewers().includes(user!.email.toLowerCase());
}

/**
 * A brand client: an approved account with no agency role (staff always get one at signup).
 * Clients see only their brands' ad pages (via company_members) and the call audit if listed above.
 */
export function isClient(user: { roles: readonly string[] } | null | undefined): boolean {
  return Boolean(user) && user!.roles.length === 0;
}

export const CLIENT_BRAND_PAGES = ["meta-ads", "google-ads"] as const;

/** Paths a client may open. Enforced in middleware; pages themselves only check roles. */
export function clientMayOpen(path: string, brandSlugs: readonly string[]): boolean {
  if (path.startsWith("/call-audit") || path.startsWith("/api/")) return true;
  const m = path.match(/^\/companies\/([^/]+)\/([^/]+)/);
  return Boolean(m && brandSlugs.includes(m[1]) && (CLIENT_BRAND_PAGES as readonly string[]).includes(m[2]));
}

/** God-mode users set this cookie to see the app exactly as a brand client does. */
export const AUDIT_PREVIEW_COOKIE = "call-audit-preview";
