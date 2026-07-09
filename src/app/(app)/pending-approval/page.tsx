import { SignOutButton } from "@clerk/nextjs";
import { Clock, ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default async function PendingApprovalPage({
  searchParams,
}: {
  searchParams: Promise<{ rejected?: string }>;
}) {
  const { rejected } = await searchParams;
  const isRejected = rejected === "1";

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="max-w-md border-white/10 bg-white/[0.02] p-8 text-center">
        {isRejected ? (
          <ShieldX className="mx-auto mb-4 h-12 w-12 text-destructive" />
        ) : (
          <Clock className="mx-auto mb-4 h-12 w-12 text-violet-400" />
        )}
        <h1 className="text-xl font-semibold">
          {isRejected ? "Access denied" : "Awaiting approval"}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {isRejected
            ? "Your account request was not approved. Contact your administrator for access."
            : "Your account has been created. An administrator will review and approve your access shortly. You'll receive a notification once approved."}
        </p>
        <div className="mt-6">
          <SignOutButton>
            <Button variant="outline">Sign out</Button>
          </SignOutButton>
        </div>
      </Card>
    </div>
  );
}
