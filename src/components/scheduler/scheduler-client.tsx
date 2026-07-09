"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import { Calendar, Sparkles, Plus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { generateAiCaption, saveSocialPostAction } from "@/features/scheduler/actions";
import { DriveFileUpload } from "@/components/drive/drive-file-upload";
import type { SocialPost, SocialPlatform } from "@/types";

const platformLabels: Record<SocialPlatform, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  x: "X",
  youtube: "YouTube",
};

interface SchedulerClientProps {
  posts: SocialPost[];
  companyId: string;
}

export function SchedulerClient({ posts, companyId }: SchedulerClientProps) {
  const [open, setOpen] = useState(false);
  const [caption, setCaption] = useState("");
  const [platform, setPlatform] = useState<SocialPlatform>("instagram");
  const [scheduledAt, setScheduledAt] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();

  const handleGenerateCaption = () => {
    startTransition(async () => {
      const result = await generateAiCaption(companyId, platform);
      if (result.caption) {
        setCaption(result.caption);
        toast.success("AI caption generated");
      } else {
        toast.error(result.error ?? "Failed to generate caption");
      }
    });
  };

  const scheduled = posts.filter((p) => p.status === "scheduled");
  const drafts = posts.filter((p) => p.status === "draft");

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Social Scheduler
          </h1>
          <p className="text-muted-foreground">
            Create, schedule, and publish across platforms
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/80"
          >
            <Plus className="h-4 w-4" />
            New Post
          </DialogTrigger>
          <DialogContent className="border-white/10 bg-background/95 backdrop-blur-xl">
            <DialogHeader>
              <DialogTitle>Create Post</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Platform</Label>
                <Select
                  value={platform}
                  onValueChange={(v) => setPlatform(v as SocialPlatform)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(platformLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <Label>Caption</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleGenerateCaption}
                    disabled={isPending}
                    className="gap-1 text-violet-400"
                  >
                    <Sparkles className="h-3 w-3" />
                    AI Generate
                  </Button>
                </div>
                <Textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  rows={4}
                  placeholder="Write your caption..."
                />
              </div>
              <div>
                <Label>Media (Google Drive)</Label>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <DriveFileUpload
                    companyId={companyId}
                    folderType="posts"
                    label="Attach image or video"
                    onUploaded={(file) =>
                      setAttachedFiles((prev) => [...prev, file.name])
                    }
                  />
                  {attachedFiles.map((name) => (
                    <Badge key={name} variant="outline" className="text-xs">
                      {name}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <Label>Schedule</Label>
                <Input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                />
              </div>
              <Button
                className="w-full"
                disabled={isPending || !caption.trim()}
                onClick={() => {
                  startTransition(async () => {
                    await saveSocialPostAction(companyId, {
                      caption,
                      platforms: [platform],
                      status: scheduledAt ? "scheduled" : "draft",
                      scheduledAt: scheduledAt || undefined,
                      mediaUrls: attachedFiles,
                    });
                    toast.success(scheduledAt ? "Post scheduled" : "Draft saved");
                    setOpen(false);
                    setCaption("");
                    setScheduledAt("");
                    setAttachedFiles([]);
                    window.location.reload();
                  });
                }}
              >
                {scheduledAt ? "Schedule Post" : "Save Draft"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <Calendar className="h-4 w-4" />
            Scheduled ({scheduled.length})
          </h2>
          <div className="space-y-3">
            {scheduled.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
            {scheduled.length === 0 && (
              <Card className="border-white/5 bg-white/[0.02] p-8 text-center text-muted-foreground">
                No scheduled posts
              </Card>
            )}
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-lg font-semibold">Drafts ({drafts.length})</h2>
          <div className="space-y-3">
            {drafts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
            {drafts.length === 0 && (
              <Card className="border-white/5 bg-white/[0.02] p-8 text-center text-muted-foreground">
                No drafts
              </Card>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function PostCard({ post }: { post: SocialPost }) {
  return (
    <Card className="border-white/5 bg-white/[0.02] p-4 backdrop-blur-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {post.platforms.map((p) => (
            <Badge key={p} variant="outline" className="text-xs">
              {platformLabels[p]}
            </Badge>
          ))}
          {post.ai_generated && (
            <Badge variant="secondary" className="text-xs">
              AI
            </Badge>
          )}
        </div>
        <Badge>{post.status}</Badge>
      </div>
      <p className="mt-2 text-sm line-clamp-2">{post.caption}</p>
      {post.scheduled_at && (
        <p className="mt-2 text-xs text-muted-foreground">
          {format(new Date(post.scheduled_at), "MMM d, yyyy · h:mm a")}
        </p>
      )}
    </Card>
  );
}
