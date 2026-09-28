"use client";

import { useMemo, useRef, useState, useSyncExternalStore } from "react";
import { formatDistanceToNow } from "date-fns";
import { Check, Copy, FileUp, Lock, ShieldCheck, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { MAX_DROP_BYTES, sealDrop } from "@/lib/drops/crypto";
import type { DropSummary } from "@/lib/db/drops";

const LINKS_KEY = "drop-links";
const EXPIRY = [
  { hours: 1, label: "1 hour" },
  { hours: 24, label: "1 day" },
  { hours: 72, label: "3 days" },
  { hours: 168, label: "7 days" },
];
const DOWNLOADS = [1, 3, 10, 50];

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function savedLinks(raw = localStorage.getItem(LINKS_KEY)): Record<string, string> {
  try {
    return JSON.parse(raw ?? "{}");
  } catch {
    return {};
  }
}

function subscribeStorage(cb: () => void) {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
}

const selectClass =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

export function DropsClient({ initialDrops }: { initialDrops: DropSummary[] }) {
  const [drops, setDrops] = useState(initialDrops);
  const [files, setFiles] = useState<File[]>([]);
  const [note, setNote] = useState("");
  const [password, setPassword] = useState("");
  const [expiresInHours, setExpiresInHours] = useState(24);
  const [maxDownloads, setMaxDownloads] = useState(1);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const rawLinks = useSyncExternalStore(
    subscribeStorage,
    () => localStorage.getItem(LINKS_KEY),
    () => null
  );
  const links = useMemo(() => savedLinks(rawLinks), [rawLinks]);
  const inputRef = useRef<HTMLInputElement>(null);

  const totalSize = files.reduce((n, f) => n + f.size, 0) + note.length;
  const tooBig = totalSize > MAX_DROP_BYTES - 1024;

  function addFiles(list: FileList | null) {
    if (list) setFiles((prev) => [...prev, ...Array.from(list)]);
  }

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
    toast.success("Link copied");
  }

  async function refresh() {
    const res = await fetch("/api/drops");
    if (res.ok) setDrops((await res.json()).drops);
  }

  async function create() {
    if (!note.trim() && files.length === 0) return;
    setBusy(true);
    try {
      const sealed = await sealDrop(
        {
          note,
          files: await Promise.all(
            files.map(async (f) => ({
              name: f.name,
              type: f.type || "application/octet-stream",
              data: new Uint8Array(await f.arrayBuffer()),
            }))
          ),
        },
        password
      );
      const summary = [
        files.length ? `${files.length} file${files.length > 1 ? "s" : ""}` : null,
        note.trim() ? "note" : null,
      ]
        .filter(Boolean)
        .join(" + ");
      const res = await fetch("/api/drops", {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
          "x-drop-meta": JSON.stringify({
            iv: sealed.iv,
            salt: sealed.salt,
            authToken: sealed.authToken,
            hasPassword: password.length > 0,
            summary,
            maxDownloads,
            expiresInHours,
          }),
        },
        body: sealed.ciphertext,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");

      const url = `${window.location.origin}/d/${data.id}#${sealed.secret}`;
      const next = { ...savedLinks(), [data.id]: url };
      localStorage.setItem(LINKS_KEY, JSON.stringify(next));
      window.dispatchEvent(new StorageEvent("storage"));
      setLink(url);
      setFiles([]);
      setNote("");
      setPassword("");
      await copy(url);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create drop");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    const res = await fetch(`/api/drops/${id}`, { method: "DELETE" });
    if (res.ok) {
      setDrops((d) => d.filter((x) => x.id !== id));
      toast.success("Drop deleted");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <Card className="space-y-5 p-6">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            addFiles(e.dataTransfer.files);
          }}
          onClick={() => inputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors ${
            dragging ? "border-primary bg-accent" : "border-border hover:bg-muted/50"
          }`}
        >
          <FileUp className="h-8 w-8 text-primary" />
          <p className="font-medium">Drop files here or click to choose</p>
          <p className="text-xs text-muted-foreground">
            Up to {formatBytes(MAX_DROP_BYTES)} total · encrypted in your browser before upload
          </p>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {files.length > 0 && (
          <ul className="divide-y rounded-md border">
            {files.map((f, i) => (
              <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="truncate">{f.name}</span>
                <span className="flex shrink-0 items-center gap-2 text-muted-foreground">
                  {formatBytes(f.size)}
                  <button
                    type="button"
                    aria-label={`Remove ${f.name}`}
                    className="rounded p-0.5 hover:bg-muted"
                    onClick={() => setFiles((prev) => prev.filter((_, j) => j !== i))}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="drop-note">Private note</Label>
          <Textarea
            id="drop-note"
            rows={4}
            placeholder="Passwords, instructions, anything sensitive…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="drop-expiry">Expires after</Label>
            <select
              id="drop-expiry"
              className={selectClass}
              value={expiresInHours}
              onChange={(e) => setExpiresInHours(Number(e.target.value))}
            >
              {EXPIRY.map((o) => (
                <option key={o.hours} value={o.hours}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="drop-downloads">Max opens</Label>
            <select
              id="drop-downloads"
              className={selectClass}
              value={maxDownloads}
              onChange={(e) => setMaxDownloads(Number(e.target.value))}
            >
              {DOWNLOADS.map((n) => (
                <option key={n} value={n}>{n === 1 ? "1 (burn after reading)" : n}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="drop-password">Password (optional)</Label>
            <Input
              id="drop-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className={`text-xs ${tooBig ? "text-destructive" : "text-muted-foreground"}`}>
            {formatBytes(totalSize)} of {formatBytes(MAX_DROP_BYTES)}
          </p>
          <Button onClick={create} disabled={busy || tooBig || (!note.trim() && files.length === 0)}>
            <Lock className="mr-1.5 h-4 w-4" />
            {busy ? "Encrypting…" : "Encrypt & create link"}
          </Button>
        </div>

        {link && (
          <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-accent p-3">
            <Check className="h-4 w-4 shrink-0 text-primary" />
            <code className="min-w-0 flex-1 truncate text-xs">{link}</code>
            <Button size="sm" variant="outline" onClick={() => copy(link)}>
              <Copy className="mr-1 h-3.5 w-3.5" /> Copy
            </Button>
          </div>
        )}
      </Card>

      <div className="space-y-4">
        <Card className="space-y-2 p-5">
          <p className="flex items-center gap-2 font-medium">
            <ShieldCheck className="h-4 w-4 text-primary" /> Zero-knowledge
          </p>
          <p className="text-sm text-muted-foreground">
            Files and notes are encrypted with AES-256 in your browser. The key only exists in the
            part of the link after <code>#</code>, which browsers never send to our server. We can’t
            read your drops, and neither can anyone without the full link (and password, if set).
          </p>
        </Card>

        <Card className="p-5">
          <p className="mb-3 font-medium">Your active drops</p>
          {drops.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing shared right now.</p>
          ) : (
            <ul className="space-y-3">
              {drops.map((d) => (
                <li key={d.id} className="rounded-md border p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{d.summary || "Drop"}</span>
                    <span className="text-xs text-muted-foreground">{formatBytes(d.size_bytes)}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <Badge variant="secondary">
                      {d.download_count}/{d.max_downloads} opened
                    </Badge>
                    {d.has_password && <Badge variant="secondary">password</Badge>}
                    <span>expires {formatDistanceToNow(new Date(d.expires_at), { addSuffix: true })}</span>
                  </div>
                  <div className="mt-2 flex gap-2">
                    {links[d.id] && (
                      <Button size="sm" variant="outline" onClick={() => copy(links[d.id])}>
                        <Copy className="mr-1 h-3.5 w-3.5" /> Copy link
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => revoke(d.id)}>
                      <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
