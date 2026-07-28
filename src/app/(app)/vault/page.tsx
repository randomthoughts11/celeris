import { VaultClient } from "@/components/vault/vault-client";
import { getCompanies } from "@/features/companies/queries";
import { requireSession } from "@/lib/auth/page-guards";
import { listVaultEntries } from "@/lib/db/vault";
import { listApprovedUsers } from "@/lib/db/users";

export default async function VaultPage() {
  const user = await requireSession();

  const [entries, users, companies] = await Promise.all([
    listVaultEntries(user),
    listApprovedUsers(),
    getCompanies(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Vault</h1>
        <p className="text-muted-foreground">
          Encrypted credentials for the agency and its brands. Share entries
          with the teammates who need them.
        </p>
      </div>
      <VaultClient
        entries={entries}
        currentUserId={user.id}
        users={users.map((u) => ({ id: u.id, name: u.full_name }))}
        companies={companies.map((c) => ({ id: c.id, name: c.name }))}
      />
    </div>
  );
}
