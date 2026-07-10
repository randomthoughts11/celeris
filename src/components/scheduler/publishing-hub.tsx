import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const PLATFORMS = [
  {
    id: "meta",
    name: "Meta Business Suite",
    description: "Schedule Facebook & Instagram posts, manage pages",
    url: "https://business.facebook.com/latest/content",
    color: "text-blue-400",
  },
  {
    id: "instagram",
    name: "Instagram",
    description: "Create posts, reels, and stories in the native app",
    url: "https://www.instagram.com/",
    color: "text-pink-400",
  },
  {
    id: "x",
    name: "X (Twitter)",
    description: "Compose posts and manage your X presence",
    url: "https://x.com/compose/post",
    color: "text-sky-400",
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    description: "Company page posts and articles",
    url: "https://www.linkedin.com/company/",
    color: "text-blue-300",
  },
  {
    id: "youtube",
    name: "YouTube Studio",
    description: "Upload videos and manage your channel",
    url: "https://studio.youtube.com/",
    color: "text-red-400",
  },
  {
    id: "tiktok",
    name: "TikTok Business",
    description: "Upload and schedule TikTok content",
    url: "https://www.tiktok.com/business/",
    color: "text-fuchsia-400",
  },
] as const;

interface PublishingHubProps {
  companyName: string;
  companyWebsite?: string | null;
}

export function PublishingHub({ companyName, companyWebsite }: PublishingHubProps) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Publishing Hub</h1>
        <p className="text-muted-foreground">
          Post and schedule on each platform&apos;s native tools — Agency OS tracks tasks &amp; approvals here.
        </p>
      </div>

      <Card className="border-white/5 bg-white/[0.02] p-5">
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">How this works:</strong> We don&apos;t replace Meta, X, or LinkedIn schedulers.
          Use the links below to publish on each channel. Mark related tasks complete in{" "}
          <strong className="text-foreground">Tasks</strong> so your team and admins see progress for{" "}
          <strong className="text-foreground">{companyName}</strong>.
        </p>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PLATFORMS.map((platform) => (
          <Card
            key={platform.id}
            className="flex flex-col border-white/5 bg-white/[0.02] p-5 transition-colors hover:border-white/10"
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className={`font-semibold ${platform.color}`}>{platform.name}</h3>
              <Badge variant="outline" className="text-[10px]">
                External
              </Badge>
            </div>
            <p className="mb-4 flex-1 text-sm text-muted-foreground">
              {platform.description}
            </p>
            <a href={platform.url} target="_blank" rel="noopener noreferrer">
              <Button className="w-full gap-2" variant="outline">
                Open {platform.name.split(" ")[0]}
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </a>
          </Card>
        ))}
      </div>

      {companyWebsite && (
        <Card className="border-white/5 bg-white/[0.02] p-4">
          <p className="text-sm text-muted-foreground">
            Client website:{" "}
            <a
              href={companyWebsite.startsWith("http") ? companyWebsite : `https://${companyWebsite}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-violet-400 hover:underline"
            >
              {companyWebsite}
            </a>
          </p>
        </Card>
      )}
    </div>
  );
}
