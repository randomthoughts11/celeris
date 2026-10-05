import { AppShell } from "@/components/layout/app-shell";
import { getSessionUser } from "@/lib/auth/session";
import { canViewCallAudit } from "@/lib/call-audit/access";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();

  if (!user || user.approvalStatus !== "approved") {
    return children;
  }

  return (
    <AppShell user={user} showCallAudit={canViewCallAudit(user)}>
      {children}
    </AppShell>
  );
}
