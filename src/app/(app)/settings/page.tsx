import { getCompanies } from "@/features/companies/queries";
import { getDriveStatus } from "@/features/drive/queries";
import { SettingsIntegrations } from "@/components/settings/settings-integrations";
import { MissionCriticalSync } from "@/components/settings/mission-critical-sync";
import { isGoogleDriveConfigured } from "@/lib/google-drive/service";
import { isMetaAgencyConfigured } from "@/lib/integrations/meta-agency";
import { getGoogleAdsConfigStatus } from "@/lib/config/google-oauth";
import { isAgencyConnected } from "@/lib/db/agency-credentials";
import { requireSettingsAccess } from "@/lib/auth/page-guards";

export default async function SettingsPage() {
  await requireSettingsAccess();

  const companies = await getCompanies();
  const driveStatuses = await Promise.all(
    companies.map(async (c) => ({
      companyId: c.id,
      slug: c.slug,
      name: c.name,
      drive: await getDriveStatus(c.id),
    }))
  );

  const [googleConnected, metaConnected] = await Promise.all([
    isAgencyConnected("google"),
    isAgencyConnected("meta"),
  ]);

  const googleStatus = getGoogleAdsConfigStatus();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-muted-foreground">
          Connect agency accounts, manage integrations, and storage.
        </p>
      </div>
      <SettingsIntegrations
        companies={driveStatuses}
        googleConfigured={googleStatus.ready}
        googleConfigHint={
          googleStatus.ready
            ? "Server env OK — click Connect to authorize your Google account."
            : `Missing on server: ${googleStatus.missing.join(", ")}`
        }
        metaConfigured={isMetaAgencyConfigured()}
        googleConnected={googleConnected}
        metaConnected={metaConnected}
        driveConfigured={isGoogleDriveConfigured()}
      />
      <MissionCriticalSync
        appUrl={process.env.NEXT_PUBLIC_APP_URL ?? "https://celeris-bice.vercel.app"}
        companies={companies.map((c) => ({ id: c.id, name: c.name }))}
        privyrSecretConfigured={Boolean(process.env.PRIVR_SYNC_WEBHOOK_SECRET)}
      />
    </div>
  );
}
