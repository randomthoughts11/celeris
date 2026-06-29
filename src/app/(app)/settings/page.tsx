import { getCompanies } from "@/features/companies/queries";
import { getDriveStatus } from "@/features/drive/queries";
import { SettingsIntegrations } from "@/components/settings/settings-integrations";
import { isGoogleDriveConfigured } from "@/lib/google-drive/service";

export default async function SettingsPage() {
  const companies = await getCompanies();
  const driveStatuses = await Promise.all(
    companies.map(async (c) => ({
      companyId: c.id,
      slug: c.slug,
      name: c.name,
      drive: await getDriveStatus(c.id),
    }))
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-muted-foreground">
          Integrations, storage, and preferences
        </p>
      </div>
      <SettingsIntegrations
        companies={driveStatuses}
        googleConfigured={isGoogleDriveConfigured()}
      />
    </div>
  );
}
