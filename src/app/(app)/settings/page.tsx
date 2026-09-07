import { getCompanies } from "@/features/companies/queries";
import { getDriveStatus } from "@/features/drive/queries";
import { SettingsIntegrations } from "@/components/settings/settings-integrations";
import { MissionCriticalSync } from "@/components/settings/mission-critical-sync";
import { isGoogleDriveConfigured } from "@/lib/google-drive/service";
import { isMetaAgencyConfigured } from "@/lib/integrations/meta-agency";
import { getGoogleAdsConfigStatus } from "@/lib/config/google-oauth";
import { isAgencyConnected } from "@/lib/db/agency-credentials";
import { requireSettingsAccess } from "@/lib/auth/page-guards";
import { canManageCompanies } from "@/lib/auth/access";
import { elevenLabsStatusMessage } from "@/lib/integrations/elevenlabs";
import { wixStatusMessage } from "@/lib/integrations/wix";
import { twilioStatusMessage } from "@/lib/integrations/twilio";
import { messagingAiConfigured } from "@/lib/integrations/messaging-ai";

export default async function SettingsPage() {
  const user = await requireSettingsAccess();

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
          Agency OAuth, Drive per brand, inbound webhooks, and Vande AI integrations.
        </p>
      </div>
      <SettingsIntegrations
        companies={driveStatuses}
        googleConfigured={googleStatus.ready}
        googleConfigHint={
          googleStatus.ready
            ? googleStatus.optional.length
              ? `Server env OK. Optional: ${googleStatus.optional.join("; ")}.`
              : "Server env OK — click Connect to authorize your Google account."
            : `Missing on server: ${googleStatus.missing.join(", ")}`
        }
        metaConfigured={isMetaAgencyConfigured()}
        googleConnected={googleConnected}
        metaConnected={metaConnected}
        driveConfigured={isGoogleDriveConfigured()}
        canConnectAgency={canManageCompanies(user)}
      />
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
        <h2 className="text-sm font-medium">Vande AI CRM integrations</h2>
        <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
          <li>ElevenLabs: {elevenLabsStatusMessage()}</li>
          <li>Wix Bookings: {wixStatusMessage()}</li>
          <li>Twilio SMS: {twilioStatusMessage()}</li>
          <li>
            AI messaging:{" "}
            {messagingAiConfigured()
              ? "OPENAI_API_KEY present"
              : "Add OPENAI_API_KEY"}
          </li>
          <li>
            Email inbound:{" "}
            {process.env.RESEND_API_KEY
              ? "RESEND configured (requires RESEND_WEBHOOK_SECRET)"
              : "Add RESEND_API_KEY + RESEND_WEBHOOK_SECRET → /api/webhooks/email"}
          </li>
          <li>
            Website widget: POST /api/webhooks/website (requires WEBSITE_CHAT_SECRET)
          </li>
          <li>
            Automations cron: POST /api/cron/automations (requires CRON_SECRET)
          </li>
          <li>
            Meta messaging: META_APP_SECRET + META_WEBHOOK_VERIFY_TOKEN required
          </li>
          <li>
            ElevenLabs webhook: requires ELEVENLABS_WEBHOOK_SECRET
          </li>
        </ul>
      </div>
      <MissionCriticalSync
        appUrl={process.env.NEXT_PUBLIC_APP_URL ?? "https://celeris-bice.vercel.app"}
        companies={companies.map((c) => ({ id: c.id, name: c.name }))}
      />
    </div>
  );
}
