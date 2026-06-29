"use client";

import { useRef, useState } from "react";
import { Upload, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface DriveFileUploadProps {
  companyId: string;
  folderType?: "posts" | "assets" | "reports";
  onUploaded?: (file: {
    id: string;
    name: string;
    webViewLink: string;
    thumbnailLink?: string;
  }) => void;
  accept?: string;
  label?: string;
}

export function DriveFileUpload({
  companyId,
  folderType = "assets",
  onUploaded,
  accept = "image/*,video/*,.pdf",
  label = "Upload to Drive",
}: DriveFileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("companyId", companyId);
    formData.append("folderType", folderType);

    try {
      const res = await fetch("/api/drive/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      toast.success(`Uploaded ${file.name} to Google Drive`);
      onUploaded?.(data.file);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className="gap-1.5"
      >
        {uploading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Upload className="h-3.5 w-3.5" />
        )}
        {uploading ? "Uploading..." : label}
      </Button>
    </>
  );
}
