import { notFound } from "next/navigation";
import { DrivePanel } from "@/components/drive/drive-panel";
import { getCompanyBySlug } from "@/features/companies/queries";
import { getDriveFiles, getDriveStatus } from "@/features/drive/queries";
import { requireCompanyPageAccess } from "@/lib/auth/page-guards";
import { isGoogleDriveConfigured } from "@/lib/google-drive/service";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function CompanyDrivePage({ params }: PageProps) {
  await requireCompanyPageAccess("drive");
  const { slug } = await params;
  const company = await getCompanyBySlug(slug);
  if (!company) notFound();

  const [status, files] = await Promise.all([
    getDriveStatus(company.id),
    getDriveFiles(company.id),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Storage</h1>
        <p className="text-muted-foreground">
          Google Drive files for {company.name}
        </p>
      </div>

      <DrivePanel
        companyId={company.id}
        companyName={company.name}
        connected={status.connected}
        connectedEmail={status.connectedEmail}
        files={files}
        googleConfigured={isGoogleDriveConfigured()}
      />
    </div>
  );
}
