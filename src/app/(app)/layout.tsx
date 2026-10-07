import { cookies } from "next/headers";
import { AppShell } from "@/components/layout/app-shell";
import { getSessionUser } from "@/lib/auth/session";
import { AUDIT_PREVIEW_COOKIE, canViewCallAudit, isAuditOnly } from "@/lib/call-audit/access";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();

  if (!user || user.approvalStatus !== "approved") {
    return children;
  }

  const preview = user.roles.includes("god_mode") && (await cookies()).has(AUDIT_PREVIEW_COOKIE);

  return (
    <AppShell user={user} showCallAudit={canViewCallAudit(user)} auditOnly={preview || isAuditOnly(user)}>
      {children}
    </AppShell>
  );
}
