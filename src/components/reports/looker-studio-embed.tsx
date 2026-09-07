import { Card } from "@/components/ui/card";
import { parseLookerEmbedUrl } from "@/lib/integrations/looker-studio";

interface LookerStudioEmbedProps {
  url: string;
  title?: string;
}

export function LookerStudioEmbed({
  url,
  title = "Ads dashboard",
}: LookerStudioEmbedProps) {
  const embedUrl = parseLookerEmbedUrl(url);
  if (!embedUrl) return null;

  return (
    <Card className="overflow-hidden border-white/5 bg-white/[0.02] p-0">
      <iframe
        src={embedUrl}
        title={title}
        className="h-[min(85vh,900px)] w-full border-0"
        allowFullScreen
        sandbox="allow-storage-access-by-user-activation allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      />
    </Card>
  );
}
