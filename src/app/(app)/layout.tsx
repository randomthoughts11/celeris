import { AppShell } from "@/components/layout/app-shell";
import { getSessionUser } from "@/lib/auth/session";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();

  if (!user) {
    return children;
  }

  return <AppShell user={user}>{children}</AppShell>;
}
