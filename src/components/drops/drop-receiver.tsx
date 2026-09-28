"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Download, Flame, Lock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { deriveAuthToken, openDrop, type DropContents } from "@/lib/drops/crypto";
import { formatBytes } from "@/components/drops/drops-client";

interface Meta {
  salt: string;
  hasPassword: boolean;
  sizeBytes: number;
  expiresAt: string;
  remaining: number;
}

function subscribeHash(cb: () => void) {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
}

export function DropReceiver({ id }: { id: string }) {
  const hash = useSyncExternalStore(subscribeHash, () => window.location.hash.slice(1), () => null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [fetchError, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [contents, setContents] = useState<DropContents | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const key = hash;
  const error =
    key === ""
      ? "This link is missing its key. Ask the sender for the full link."
      : fetchError;

  useEffect(() => {
    if (!key) return;
    fetch(`/api/drops/${id}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setMeta(data);
      })
      .catch((e: Error) => setError(e.message || "Drop not found"));
  }, [id, key]);

  async function reveal() {
    const secret = key;
    if (!secret || !meta) return;
    setBusy(true);
    setError(null);
    try {
      const authToken = await deriveAuthToken(secret, meta.salt, password);
      const res = await fetch(`/api/drops/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authToken }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const iv = res.headers.get("X-Drop-Iv") ?? "";
      setRemaining(Number(res.headers.get("X-Drop-Remaining") ?? 0));
      const bytes = new Uint8Array(await res.arrayBuffer());
      setContents(await openDrop(bytes, iv, meta.salt, secret, password));
      history.replaceState(null, "", window.location.pathname);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not open drop");
    } finally {
      setBusy(false);
    }
  }

  function save(file: DropContents["files"][number]) {
    const url = URL.createObjectURL(new Blob([new Uint8Array(file.data)], { type: file.type }));
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-lg space-y-5 p-6">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <p className="font-semibold leading-tight">Encrypted drop</p>
            <p className="text-xs text-muted-foreground">Decrypted only in your browser</p>
          </div>
        </div>

        {error && !contents && (
          <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {error}
          </p>
        )}

        {meta && !contents && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {formatBytes(meta.sizeBytes)} encrypted ·{" "}
              {meta.remaining === 1
                ? "this can be opened once, then it’s destroyed"
                : `${meta.remaining} opens left`}
            </p>
            {meta.hasPassword && (
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && reveal()}
              />
            )}
            <Button className="w-full" onClick={reveal} disabled={busy || (meta.hasPassword && !password)}>
              <Lock className="mr-1.5 h-4 w-4" />
              {busy ? "Decrypting…" : "Open drop"}
            </Button>
          </div>
        )}

        {contents && (
          <div className="space-y-4">
            {remaining === 0 && (
              <p className="flex items-center gap-2 rounded-md bg-orange-50 p-3 text-sm text-orange-700">
                <Flame className="h-4 w-4" /> This drop has now been destroyed. Save what you need.
              </p>
            )}
            {contents.note && (
              <pre className="whitespace-pre-wrap break-words rounded-md border bg-muted/50 p-3 font-sans text-sm">
                {contents.note}
              </pre>
            )}
            {contents.files.length > 0 && (
              <ul className="divide-y rounded-md border">
                {contents.files.map((f, i) => (
                  <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                    <span className="truncate">{f.name}</span>
                    <Button size="sm" variant="outline" onClick={() => save(f)}>
                      <Download className="mr-1 h-3.5 w-3.5" /> {formatBytes(f.data.length)}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
