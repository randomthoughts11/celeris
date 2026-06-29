import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { insertDriveFile } from "@/lib/db/drive-files";
import { uploadToDrive } from "@/lib/google-drive/service";

const MAX_SIZE = 25 * 1024 * 1024; // 25 MB

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const companyId = formData.get("companyId") as string | null;
    const folderType = (formData.get("folderType") as string) || "assets";
    const entityType = formData.get("entityType") as string | null;
    const entityId = formData.get("entityId") as string | null;

    if (!file || !companyId) {
      return NextResponse.json(
        { error: "file and companyId required" },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File must be under 25 MB" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const uploaded = await uploadToDrive({
      companyId,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      buffer,
      folderType: folderType as "posts" | "assets" | "reports",
    });

    const record = await insertDriveFile({
      companyId,
      driveFileId: uploaded.driveFileId,
      name: file.name,
      mimeType: file.type || "application/octet-stream",
      folderType,
      webViewLink: uploaded.webViewLink,
      thumbnailLink: uploaded.thumbnailLink,
      sizeBytes: file.size,
      uploadedBy: user.id,
      entityType: entityType ?? undefined,
      entityId: entityId ?? undefined,
    });

    return NextResponse.json({
      success: true,
      file: {
        id: record.id,
        name: record.name,
        webViewLink: record.web_view_link,
        thumbnailLink: record.thumbnail_link,
        driveFileId: record.drive_file_id,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
