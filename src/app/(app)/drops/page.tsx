import { DropsClient } from "@/components/drops/drops-client";
import { requireGlobalNavAccess } from "@/lib/auth/page-guards";
import { listMyDrops } from "@/lib/db/drops";

export default async function DropsPage() {
  const user = await requireGlobalNavAccess("drops");
  const drops = await listMyDrops(user.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Drop</h1>
        <p className="text-muted-foreground">
          Send files and notes to clients or teammates with an end-to-end encrypted link that
          expires on its own.
        </p>
      </div>
      <DropsClient initialDrops={drops} />
    </div>
  );
}
