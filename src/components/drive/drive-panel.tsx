"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  ExternalLink,
  FileImage,
  FileText,
  FolderOpen,
  HardDrive,
  Link2,
  Unlink,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DriveFileUpload } from "@/components/drive/drive-file-upload";
import type { DriveFile } from "@/types";

interface DrivePanelProps {
  companyId: string;
  companyName: string;
  connected: boolean;
  connectedEmail?: string;
  files: DriveFile[];
  googleConfigured: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DrivePanel({
  companyId,
  companyName,
  connected,
  connectedEmail,
  files: initialFiles,
  googleConfigured,
}: DrivePanelProps) {
  const [files, setFiles] = useState(initialFiles);
  const [disconnecting, setDisconnecting] = useState(false);

  const connectUrl = `/api/integrations/google-drive/connect?companyId=${companyId}`;

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const res = await fetch("/api/integrations/google-drive/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId }),
      });
      if (!res.ok) throw new Error("Failed to disconnect");
      toast.success("Google Drive disconnected");
      window.location.reload();
    } catch {
      toast.error("Could not disconnect");
    } finally {
      setDisconnecting(false);
    }
  };

  if (!googleConfigured) {
    return (
      <Card className="border-amber-500/20 bg-amber-500/5 p-6">
        <p className="font-medium text-amber-400">Google Drive not configured</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and NEXT_PUBLIC_APP_URL to
          your environment variables.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-white/5 bg-white/[0.02] p-6 backdrop-blur-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20">
              <HardDrive className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold">Google Drive</h3>
              <p className="text-sm text-muted-foreground">
                {connected
                  ? `Connected as ${connectedEmail ?? "Google account"}`
                  : `Connect Drive for ${companyName}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant={connected ? "default" : "secondary"}>
              {connected ? "Connected" : "Not connected"}
            </Badge>
            {connected ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="gap-1.5"
              >
                <Unlink className="h-3.5 w-3.5" />
                Disconnect
              </Button>
            ) : (
              <a
                href={connectUrl}
                className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/80"
              >
                <Link2 className="h-3.5 w-3.5" />
                Connect Google Drive
              </a>
            )}
          </div>
        </div>

        {connected && (
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1 rounded bg-white/5 px-2 py-1">
              <FolderOpen className="h-3 w-3" />
              Agency OS / {companyName} / Posts
            </span>
            <span className="flex items-center gap-1 rounded bg-white/5 px-2 py-1">
              <FolderOpen className="h-3 w-3" />
              Assets
            </span>
            <span className="flex items-center gap-1 rounded bg-white/5 px-2 py-1">
              <FolderOpen className="h-3 w-3" />
              Reports
            </span>
          </div>
        )}
      </Card>

      {connected && (
        <>
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Recent files</h3>
            <DriveFileUpload
              companyId={companyId}
              folderType="assets"
              onUploaded={(file) =>
                setFiles((prev) => [
                  {
                    id: file.id,
                    company_id: companyId,
                    drive_file_id: "",
                    name: file.name,
                    mime_type: null,
                    folder_type: "assets",
                    web_view_link: file.webViewLink,
                    thumbnail_link: file.thumbnailLink ?? null,
                    size_bytes: 0,
                    uploaded_by: null,
                    entity_type: null,
                    entity_id: null,
                    created_at: new Date().toISOString(),
                  },
                  ...prev,
                ])
              }
            />
          </div>

          <div className="space-y-2">
            {files.length === 0 && (
              <Card className="border-white/5 bg-white/[0.02] p-8 text-center text-muted-foreground">
                No files uploaded yet
              </Card>
            )}
            {files.map((file) => (
              <Card
                key={file.id}
                className="flex items-center justify-between border-white/5 bg-white/[0.02] p-4"
              >
                <div className="flex items-center gap-3">
                  {file.mime_type?.startsWith("image/") ? (
                    <FileImage className="h-4 w-4 text-violet-400" />
                  ) : (
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  )}
                  <div>
                    <p className="font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {file.folder_type} · {formatBytes(file.size_bytes)} ·{" "}
                      {formatDistanceToNow(new Date(file.created_at), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                </div>
                {file.web_view_link && (
                  <a
                    href={file.web_view_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-sm text-violet-400 hover:underline"
                  >
                    Open
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
