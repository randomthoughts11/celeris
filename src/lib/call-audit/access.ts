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

/** A viewer with no agency role (e.g. the brand owner) is locked to the call audit. */
export function isAuditOnly(user: { email: string; roles: readonly string[] } | null | undefined): boolean {
  return canViewCallAudit(user) && !user!.roles.some((r) => ["god_mode", "admin", "manager"].includes(r));
}

/** God-mode users set this cookie to see the app exactly as an audit-only viewer does. */
export const AUDIT_PREVIEW_COOKIE = "call-audit-preview";
