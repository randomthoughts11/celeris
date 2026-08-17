"use client";

import Link from "next/link";
import { Copy, ExternalLink, Kanban } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const PLATFORMS = [
  {
    id: "meta",
    name: "Meta Business Suite",
    description: "Facebook and Instagram posts, reels, and scheduling",
    url: "https://business.facebook.com/latest/content",
  },
  {
    id: "instagram",
    name: "Instagram",
    description: "Stories, reels, and native composer",
    url: "https://www.instagram.com/",
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    description: "Company page posts and articles",
    url: "https://www.linkedin.com/company/",
  },
  {
    id: "x",
    name: "X",
    description: "Compose and publish",
    url: "https://x.com/compose/post",
  },
  {
    id: "youtube",
    name: "YouTube Studio",
    description: "Uploads and community posts",
    url: "https://studio.youtube.com/",
  },
  {
    id: "tiktok",
    name: "TikTok",
    description: "Upload and schedule",
    url: "https://www.tiktok.com/business/",
  },
] as const;

interface PublishingHubProps {
  companyName: string;
  companySlug: string;
  companyWebsite?: string | null;
}

function siteUrl(website: string) {
  return website.startsWith("http") ? website : `https://${website}`;
}

export function PublishingHub({
  companyName,
  companySlug,
  companyWebsite,
}: PublishingHubProps) {
  const caption = `${companyName} — new this week.`;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-violet-400">
          Launchpad
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Publish for {companyName}
        </h1>
        <p className="mt-1 text-muted-foreground">
          Open the native publisher, then mark the related Board card done.
          Scheduling stays on the platforms — this page is the launchpad.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="border-white/8 bg-white/[0.03] p-4">
          <p className="text-xs text-muted-foreground">Brand name</p>
          <p className="mt-1 font-medium">{companyName}</p>
          <CopyButton text={companyName} label="Copy name" />
        </Card>
        <Card className="border-white/8 bg-white/[0.03] p-4">
          <p className="text-xs text-muted-foreground">Starter caption</p>
          <p className="mt-1 text-sm">{caption}</p>
          <CopyButton text={caption} label="Copy caption" />
        </Card>
        <Card className="flex flex-col justify-between border-white/8 bg-white/[0.03] p-4">
          <div>
            <p className="text-xs text-muted-foreground">After you post</p>
            <p className="mt-1 text-sm">Tick the Board card so the team sees it shipped.</p>
          </div>
          <Link href={`/companies/${companySlug}/board`} className="mt-3">
            <Button variant="outline" size="sm" className="w-full gap-2">
              <Kanban className="h-3.5 w-3.5" />
              Open board
            </Button>
          </Link>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PLATFORMS.map((platform) => (
          <Card
            key={platform.id}
            className="flex flex-col border-white/8 bg-white/[0.03] p-5 transition-colors hover:border-white/15"
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">{platform.name}</h3>
              <Badge variant="outline" className="text-[10px]">
                Opens outside
              </Badge>
            </div>
            <p className="mb-4 flex-1 text-sm text-muted-foreground">
              {platform.description}
            </p>
            <a href={platform.url} target="_blank" rel="noopener noreferrer">
              <Button className="w-full gap-2" variant="outline">
                Open {platform.name}
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </a>
          </Card>
        ))}
      </div>

      {companyWebsite && (
        <p className="text-sm text-muted-foreground">
          Client site:{" "}
          <a
            href={siteUrl(companyWebsite)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-violet-400 hover:underline"
          >
            {companyWebsite}
          </a>
        </p>
      )}
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="mt-2 h-7 gap-1.5 px-2 text-xs"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        toast.success("Copied");
      }}
    >
      <Copy className="h-3 w-3" />
      {label}
    </Button>
  );
}
