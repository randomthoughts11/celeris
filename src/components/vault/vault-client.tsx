"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Copy,
  Eye,
  EyeOff,
  Globe,
  KeyRound,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Share2,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  createVaultEntryAction,
  deleteVaultEntryAction,
  revealVaultPasswordAction,
  setVaultSharesAction,
  updateVaultEntryAction,
} from "@/features/vault/actions";
import type { VaultEntry } from "@/types";
import { cn } from "@/lib/utils";

const CATEGORY_LABELS: Record<string, string> = {
  social: "Social media",
  ads: "Ad platform",
  email: "Email",
  hosting: "Hosting",
  domain: "Domain",
  tools: "Tools",
  banking: "Banking",
  other: "Other",
};

interface Option {
  id: string;
  name: string;
}

interface VaultClientProps {
  entries: VaultEntry[];
  currentUserId: string;
  users: Option[];
  companies: Option[];
}

function generatePassword(length = 20): string {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*-_";
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  return Array.from(values, (v) => chars[v % chars.length]).join("");
}

export function VaultClient({
  entries,
  currentUserId,
  users,
  companies,
}: VaultClientProps) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return entries.filter((e) => {
      if (categoryFilter !== "all" && e.category !== categoryFilter)
        return false;
      if (!q) return true;
      return [e.title, e.username, e.url, e.company_name, e.notes]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [entries, search, categoryFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1 sm:max-w-xs">
          <Search className="absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search vault…"
            className="pl-8"
          />
        </div>
        <Select
          value={categoryFilter}
          onValueChange={(v) => setCategoryFilter(v ?? "all")}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto">
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger
              render={
                <Button size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add credential
                </Button>
              }
            />
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add credential</DialogTitle>
              </DialogHeader>
              <EntryForm
                companies={companies}
                onDone={() => setCreateOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card className="flex flex-col items-center gap-2 border-white/5 bg-white/[0.02] p-10 text-center">
          <KeyRound className="h-8 w-8 text-muted-foreground" />
          <p className="font-medium">No credentials here yet</p>
          <p className="text-sm text-muted-foreground">
            Add logins for social accounts, ad platforms, hosting and more.
            Passwords are encrypted at rest.
          </p>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((entry) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              currentUserId={currentUserId}
              users={users}
              companies={companies}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EntryCard({
  entry,
  currentUserId,
  users,
  companies,
}: {
  entry: VaultEntry;
  currentUserId: string;
  users: Option[];
  companies: Option[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [password, setPassword] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const reveal = () => {
    if (password !== null) {
      setPassword(null);
      return;
    }
    startTransition(async () => {
      const result = await revealVaultPasswordAction(entry.id);
      if ("error" in result && result.error) toast.error(result.error);
      else if ("password" in result) setPassword(result.password ?? "");
    });
  };

  const copyPassword = () => {
    startTransition(async () => {
      const result = await revealVaultPasswordAction(entry.id);
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      if ("password" in result && result.password) {
        await navigator.clipboard.writeText(result.password);
        toast.success("Password copied");
      }
    });
  };

  const copyUsername = async () => {
    if (!entry.username) return;
    await navigator.clipboard.writeText(entry.username);
    toast.success("Username copied");
  };

  const remove = () => {
    startTransition(async () => {
      const result = await deleteVaultEntryAction(entry.id);
      if (result.error) toast.error(result.error);
      else {
        toast.success("Entry deleted");
        router.refresh();
      }
    });
  };

  return (
    <Card className="flex flex-col gap-3 border-white/5 bg-white/[0.02] p-4 backdrop-blur-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium">{entry.title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="text-[10px]">
              {CATEGORY_LABELS[entry.category] ?? entry.category}
            </Badge>
            {entry.company_name && (
              <Badge variant="outline" className="text-[10px]">
                {entry.company_name}
              </Badge>
            )}
          </div>
        </div>
        {entry.url && (
          <a
            href={entry.url}
            target="_blank"
            rel="noreferrer"
            className="text-muted-foreground transition-colors hover:text-foreground"
            title={entry.url}
          >
            <Globe className="h-4 w-4" />
          </a>
        )}
      </div>

      {entry.username && (
        <div className="flex items-center justify-between gap-2 rounded-md bg-white/[0.03] px-3 py-1.5">
          <span className="truncate text-sm text-muted-foreground">
            {entry.username}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={copyUsername}
            title="Copy username"
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 rounded-md bg-white/[0.03] px-3 py-1.5">
        <span
          className={cn(
            "truncate font-mono text-sm",
            password === null && "tracking-widest text-muted-foreground"
          )}
        >
          {password ?? "••••••••••"}
        </span>
        <div className="flex shrink-0 items-center">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={reveal}
            disabled={pending}
            title={password === null ? "Reveal password" : "Hide password"}
          >
            {password === null ? (
              <Eye className="h-3.5 w-3.5" />
            ) : (
              <EyeOff className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={copyPassword}
            disabled={pending}
            title="Copy password"
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {entry.notes && (
        <p className="text-xs whitespace-pre-wrap text-muted-foreground">
          {entry.notes}
        </p>
      )}

      <div className="mt-auto flex items-center justify-between gap-2 pt-1">
        <p className="text-[11px] text-muted-foreground">
          {entry.shared_with.length > 0 ? (
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              Shared with {entry.shared_with.length}
            </span>
          ) : entry.created_by === currentUserId ? (
            "Only you"
          ) : (
            `By ${entry.created_by_name ?? "unknown"}`
          )}
        </p>
        {entry.can_manage && (
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setShareOpen(true)}
              title="Share"
            >
              <Share2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setEditOpen(true)}
              title="Edit"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={remove}
              disabled={pending}
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5 text-red-400" />
            </Button>
          </div>
        )}
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit credential</DialogTitle>
          </DialogHeader>
          <EntryForm
            entry={entry}
            companies={companies}
            onDone={() => setEditOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <ShareDialog
        entry={entry}
        users={users.filter((u) => u.id !== entry.created_by)}
        open={shareOpen}
        onOpenChange={setShareOpen}
      />
    </Card>
  );
}

function EntryForm({
  entry,
  companies,
  onDone,
}: {
  entry?: VaultEntry;
  companies: Option[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [category, setCategory] = useState(entry?.category ?? "other");
  const [companyId, setCompanyId] = useState(entry?.company_id ?? "");
  const [passwordDraft, setPasswordDraft] = useState("");

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.set("category", category);
    formData.set("companyId", companyId);
    startTransition(async () => {
      const result = entry
        ? await updateVaultEntryAction(entry.id, formData)
        : await createVaultEntryAction(formData);
      if ("error" in result && result.error) toast.error(result.error);
      else {
        toast.success(entry ? "Entry updated" : "Entry added to vault");
        onDone();
        router.refresh();
      }
    });
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="vault-title">Title</Label>
        <Input
          id="vault-title"
          name="title"
          defaultValue={entry?.title}
          placeholder="e.g. Instagram — Bloom Wellness"
          required
          autoFocus
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Category</Label>
          <Select
            value={category}
            onValueChange={(v) => setCategory((v ?? "other") as never)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Company / brand</Label>
          <Select value={companyId} onValueChange={(v) => setCompanyId(v ?? "")}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Agency-wide" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Agency-wide</SelectItem>
              {companies.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="vault-username">Username / email</Label>
        <Input
          id="vault-username"
          name="username"
          defaultValue={entry?.username ?? ""}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="vault-password">
          Password{entry ? " (leave blank to keep current)" : ""}
        </Label>
        <div className="flex gap-2">
          <Input
            id="vault-password"
            name="password"
            type="text"
            autoComplete="off"
            value={passwordDraft}
            onChange={(e) => setPasswordDraft(e.target.value)}
            required={!entry}
            className="font-mono"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => setPasswordDraft(generatePassword())}
            title="Generate strong password"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="vault-url">URL</Label>
        <Input
          id="vault-url"
          name="url"
          type="url"
          placeholder="https://…"
          defaultValue={entry?.url ?? ""}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="vault-notes">Notes</Label>
        <Textarea
          id="vault-notes"
          name="notes"
          rows={2}
          defaultValue={entry?.notes ?? ""}
          placeholder="2FA backup codes location, account owner, etc."
        />
      </div>
      <Button type="submit" disabled={pending}>
        {entry ? "Save changes" : "Add to vault"}
      </Button>
    </form>
  );
}

function ShareDialog({
  entry,
  users,
  open,
  onOpenChange,
}: {
  entry: VaultEntry;
  users: Option[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(entry.shared_with.map((s) => s.id))
  );

  // Re-seed selection each time the dialog opens.
  const [prevOpen, setPrevOpen] = useState(false);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setSelected(new Set(entry.shared_with.map((s) => s.id)));
  }

  const toggle = (userId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const save = () => {
    startTransition(async () => {
      const result = await setVaultSharesAction(entry.id, [...selected]);
      if (result.error) toast.error(result.error);
      else {
        toast.success("Sharing updated");
        onOpenChange(false);
        router.refresh();
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Share “{entry.title}”</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Selected teammates can view and copy this password. Admins always
          have access.
        </p>
        <div className="max-h-64 space-y-1 overflow-y-auto">
          {users.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No other teammates yet.
            </p>
          )}
          {users.map((u) => (
            <label
              key={u.id}
              className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-white/5"
            >
              <Checkbox
                checked={selected.has(u.id)}
                onCheckedChange={() => toggle(u.id)}
              />
              {u.name}
            </label>
          ))}
        </div>
        <Button onClick={save} disabled={pending}>
          Save sharing
        </Button>
      </DialogContent>
    </Dialog>
  );
}
