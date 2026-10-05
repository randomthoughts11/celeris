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
