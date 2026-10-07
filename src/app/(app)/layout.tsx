import { cookies } from "next/headers";
import { AppShell } from "@/components/layout/app-shell";
import { getSessionUser } from "@/lib/auth/session";
import { AUDIT_PREVIEW_COOKIE, canViewCallAudit, isClient } from "@/lib/call-audit/access";
import { getSql } from "@/lib/db/client";

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
  const sql = getSql();
  const clientBrands = preview
    ? await sql`SELECT slug, name FROM companies WHERE slug = ${process.env.CALL_AUDIT_COMPANY_SLUG || "vande-wellness-us"}`
    : isClient(user)
      ? await sql`
          SELECT c.slug, c.name FROM companies c JOIN company_members m ON m.company_id = c.id
          WHERE m.user_id = ${user.id} ORDER BY c.name
        `
      : undefined;

  return (
    <AppShell user={user} showCallAudit={canViewCallAudit(user)} clientBrands={clientBrands as Array<{ slug: string; name: string }> | undefined}>
      {children}
    </AppShell>
  );
}
