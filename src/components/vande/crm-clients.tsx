"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type {
  Appointment,
  AiCall,
  Branch,
  Conversation,
  CrmMessage,
  Customer,
  DashboardWidget,
  KnowledgeDoc,
  Lead,
  LeadStatus,
  AutomationRule,
  Sequence,
  WebhookEndpoint,
} from "@/types";
import {
  createBranchAction,
  toggleBranchAction,
  createCustomerAction,
  convertLeadAction,
  createAppointmentAction,
  updateAppointmentStatusAction,
  startAiCallAction,
  transferAiCallAction,
  sendMessageAction,
  aiSuggestReplyAction,
  createConversationAction,
  createKnowledgeDocAction,
  saveDashboardAction,
  createAutomationRuleAction,
  toggleAutomationAction,
  createSequenceAction,
  createWebhookEndpointAction,
  createCustomFieldAction,
  createLeadFollowUpAction,
  updateLeadStatusWithAutomationAction,
} from "@/features/vande/actions";

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl border border-white/10 bg-white/[0.03] p-4 ${className}`}>
      {children}
    </div>
  );
}

function Btn({
  children,
  onClick,
  disabled,
  variant = "primary",
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "ghost";
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={
        variant === "primary"
          ? "rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
          : "rounded-lg border border-white/10 px-3 py-1.5 text-sm text-muted-foreground hover:bg-white/5 disabled:opacity-50"
      }
    >
      {children}
    </button>
  );
}

const inputCls =
  "w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none focus:border-violet-500";

// ── Branches ───────────────────────────────────────────────────────────────
export function BranchesClient({
  companyId,
  branches,
}: {
  companyId: string;
  branches: Branch[];
}) {
  const [pending, start] = useTransition();
  return (
    <div className="space-y-6">
      <Card>
        <h2 className="mb-3 text-sm font-medium">Add branch</h2>
        <form
          className="grid gap-3 sm:grid-cols-2"
          action={(fd) =>
            start(async () => {
              const r = await createBranchAction(companyId, fd);
              if ("error" in r && r.error) toast.error(r.error);
              else toast.success("Branch created");
            })
          }
        >
          <input name="name" placeholder="Name" required className={inputCls} />
          <input name="code" placeholder="Code" className={inputCls} />
          <input name="city" placeholder="City" className={inputCls} />
          <input name="phone" placeholder="Phone" className={inputCls} />
          <input name="address" placeholder="Address" className={`sm:col-span-2 ${inputCls}`} />
          <Btn type="submit" disabled={pending}>Create</Btn>
        </form>
      </Card>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {branches.map((b) => (
          <Card key={b.id}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium">{b.name}</p>
                <p className="text-xs text-muted-foreground">
                  {[b.code, b.city, b.phone].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
              <Btn
                variant="ghost"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    await toggleBranchAction(companyId, b.id, !b.is_active);
                    toast.success(b.is_active ? "Deactivated" : "Activated");
                  })
                }
              >
                {b.is_active ? "Active" : "Inactive"}
              </Btn>
            </div>
          </Card>
        ))}
        {branches.length === 0 && (
          <p className="text-sm text-muted-foreground">No branches yet.</p>
        )}
      </div>
    </div>
  );
}

// ── Customers ──────────────────────────────────────────────────────────────
export function CustomersClient({
  companyId,
  customers,
  leads,
}: {
  companyId: string;
  customers: Customer[];
  leads: Lead[];
}) {
  const [pending, start] = useTransition();
  const wonCandidates = leads.filter((l) => l.status !== "won" && l.status !== "lost");
  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 text-sm font-medium">Manual customer</h2>
          <form
            className="grid gap-2"
            action={(fd) =>
              start(async () => {
                const r = await createCustomerAction(companyId, fd);
                if ("error" in r && r.error) toast.error(r.error);
                else toast.success("Customer created");
              })
            }
          >
            <input name="firstName" placeholder="First name" required className={inputCls} />
            <input name="lastName" placeholder="Last name" className={inputCls} />
            <input name="email" placeholder="Email" className={inputCls} />
            <input name="phone" placeholder="Phone" className={inputCls} />
            <input name="lifetimeValue" placeholder="LTV" type="number" className={inputCls} />
            <Btn type="submit" disabled={pending}>Create</Btn>
          </form>
        </Card>
        <Card>
          <h2 className="mb-3 text-sm font-medium">Convert lead → customer</h2>
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {wonCandidates.slice(0, 20).map((l) => (
              <div key={l.id} className="flex items-center justify-between gap-2 text-sm">
                <span>
                  {l.first_name} {l.last_name} · {l.status}
                </span>
                <Btn
                  variant="ghost"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      await convertLeadAction(companyId, l.id);
                      toast.success("Converted");
                    })
                  }
                >
                  Convert
                </Btn>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <div className="overflow-x-auto rounded-xl border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/10 text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Contact</th>
              <th className="px-3 py-2">LTV</th>
              <th className="px-3 py-2">Converted</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id} className="border-b border-white/5">
                <td className="px-3 py-2">
                  {c.first_name} {c.last_name}
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {c.email || c.phone || "—"}
                </td>
                <td className="px-3 py-2">{c.lifetime_value}</td>
                <td className="px-3 py-2 text-muted-foreground">
                  {new Date(c.converted_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {customers.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">No customers yet.</p>
        )}
      </div>
    </div>
  );
}

// ── Pipeline ───────────────────────────────────────────────────────────────
const STAGES: LeadStatus[] = [
  "new",
  "contacted",
  "qualified",
  "proposal",
  "negotiation",
  "won",
  "lost",
  "nurture",
];

export function PipelineClient({
  companyId,
  leads,
}: {
  companyId: string;
  leads: Lead[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="flex gap-3 overflow-x-auto pb-4">
      {STAGES.map((stage) => {
        const col = leads.filter((l) => l.status === stage);
        return (
          <div
            key={stage}
            className="w-64 shrink-0 rounded-xl border border-white/10 bg-white/[0.02] p-3"
          >
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {stage}
              </h3>
              <span className="text-xs text-muted-foreground">{col.length}</span>
            </div>
            <div className="space-y-2">
              {col.map((l) => (
                <div
                  key={l.id}
                  className="rounded-lg border border-white/10 bg-black/20 p-2 text-sm"
                >
                  <p className="font-medium">
                    {l.first_name} {l.last_name}
                  </p>
                  <p className="text-xs text-muted-foreground">{l.source || "—"}</p>
                  <select
                    className="mt-2 w-full rounded border border-white/10 bg-transparent px-1 py-1 text-xs"
                    value={l.status}
                    disabled={pending}
                    onChange={(e) =>
                      start(async () => {
                        const r = await updateLeadStatusWithAutomationAction(
                          l.id,
                          companyId,
                          e.target.value as LeadStatus
                        );
                        if (r && "error" in r && r.error) toast.error(String(r.error));
                        else {
                          toast.success("Stage updated");
                          router.refresh();
                        }
                      })
                    }
                  >
                    {STAGES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <form
                    className="mt-2 space-y-1"
                    action={(fd) =>
                      start(async () => {
                        await createLeadFollowUpAction(companyId, l.id, fd);
                        toast.success("Follow-up created");
                        router.refresh();
                      })
                    }
                  >
                    <input
                      name="title"
                      placeholder="Follow-up"
                      className="w-full rounded border border-white/10 bg-transparent px-1 py-1 text-xs"
                    />
                    <input
                      name="followUpAt"
                      type="datetime-local"
                      className="w-full rounded border border-white/10 bg-transparent px-1 py-1 text-xs"
                    />
                    <Btn type="submit" variant="ghost" disabled={pending}>
                      Add follow-up
                    </Btn>
                  </form>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Appointments ───────────────────────────────────────────────────────────
export function AppointmentsClient({
  companyId,
  appointments,
  leads,
  wixStatus,
}: {
  companyId: string;
  appointments: Appointment[];
  leads: Lead[];
  wixStatus: string;
}) {
  const [pending, start] = useTransition();
  return (
    <div className="space-y-6">
      <p className="text-xs text-muted-foreground">Wix: {wixStatus}</p>
      <Card>
        <h2 className="mb-3 text-sm font-medium">New appointment</h2>
        <form
          className="grid gap-2 sm:grid-cols-2"
          action={(fd) =>
            start(async () => {
              const r = await createAppointmentAction(companyId, fd);
              if ("error" in r && r.error) toast.error(r.error);
              else toast.success("Booked");
            })
          }
        >
          <input name="title" placeholder="Title" required className={inputCls} />
          <input name="startsAt" type="datetime-local" required className={inputCls} />
          <input name="amount" type="number" placeholder="Amount" className={inputCls} />
          <input name="notifyPhone" placeholder="SMS notify phone" className={inputCls} />
          <select name="leadId" className={inputCls}>
            <option value="">Lead (optional)</option>
            {leads.map((l) => (
              <option key={l.id} value={l.id}>
                {l.first_name} {l.last_name}
              </option>
            ))}
          </select>
          <input name="location" placeholder="Location" className={inputCls} />
          <Btn type="submit" disabled={pending}>Create booking</Btn>
        </form>
      </Card>
      <div className="space-y-2">
        {appointments.map((a) => (
          <Card key={a.id} className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium">{a.title}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(a.starts_at).toLocaleString()} · {a.status} · ₹{a.amount}
              </p>
              {(a.booking_url || a.payment_url) && (
                <p className="mt-1 text-xs text-violet-400">
                  {a.booking_url && (
                    <a href={a.booking_url} target="_blank" rel="noreferrer" className="mr-3 underline">
                      Booking link
                    </a>
                  )}
                  {a.payment_url && (
                    <a href={a.payment_url} target="_blank" rel="noreferrer" className="underline">
                      Payment link
                    </a>
                  )}
                </p>
              )}
            </div>
            <select
              className="rounded border border-white/10 bg-transparent px-2 py-1 text-xs"
              value={a.status}
              disabled={pending}
              onChange={(e) =>
                start(async () => {
                  await updateAppointmentStatusAction(
                    companyId,
                    a.id,
                    e.target.value as Appointment["status"]
                  );
                  toast.success("Updated");
                })
              }
            >
              {["scheduled", "confirmed", "completed", "cancelled", "no_show"].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── AI Calls ───────────────────────────────────────────────────────────────
export function AiCallsClient({
  companyId,
  calls,
  leads,
  elevenStatus,
}: {
  companyId: string;
  calls: AiCall[];
  leads: Lead[];
  elevenStatus: string;
}) {
  const [pending, start] = useTransition();
  return (
    <div className="space-y-6">
      <p className="text-xs text-muted-foreground">ElevenLabs: {elevenStatus}</p>
      <Card>
        <h2 className="mb-3 text-sm font-medium">Start outbound AI call</h2>
        <form
          className="grid gap-2 sm:grid-cols-3"
          action={(fd) =>
            start(async () => {
              const r = await startAiCallAction(companyId, fd);
              if ("error" in r && r.error) toast.error(r.error);
              else if ("warning" in r && r.warning) toast.message(r.warning);
              else toast.success("AI call queued");
            })
          }
        >
          <input name="phone" placeholder="+91..." required className={inputCls} />
          <select name="leadId" className={inputCls}>
            <option value="">Lead (optional)</option>
            {leads.map((l) => (
              <option key={l.id} value={l.id}>
                {l.first_name} {l.phone}
              </option>
            ))}
          </select>
          <Btn type="submit" disabled={pending}>Call with AI</Btn>
        </form>
      </Card>
      <div className="space-y-2">
        {calls.map((c) => (
          <Card key={c.id}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-medium">
                  {c.direction} · {c.phone_number || "—"} · {c.status}
                </p>
                <p className="text-xs text-muted-foreground">
                  Score {c.score ?? "—"} · {c.sentiment ?? "—"} · {c.duration_seconds}s
                </p>
                {c.summary && <p className="mt-2 text-sm">{c.summary}</p>}
                {c.transcript && (
                  <details className="mt-2 text-xs text-muted-foreground">
                    <summary>Transcript</summary>
                    <pre className="mt-1 whitespace-pre-wrap">{c.transcript}</pre>
                  </details>
                )}
              </div>
              {c.status !== "transferred" && c.status !== "completed" && (
                <Btn
                  variant="ghost"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      await transferAiCallAction(companyId, c.id);
                      toast.success("Transferred to you");
                    })
                  }
                >
                  Transfer to me
                </Btn>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── Messaging ──────────────────────────────────────────────────────────────
export function MessagesClient({
  companyId,
  conversations,
  initialMessages,
  initialConversationId,
}: {
  companyId: string;
  conversations: Conversation[];
  initialMessages: CrmMessage[];
  initialConversationId?: string;
}) {
  const [activeId, setActiveId] = useState(
    initialConversationId || conversations[0]?.id || ""
  );
  const [messages, setMessages] = useState(initialMessages);
  const [body, setBody] = useState("");
  const [pending, start] = useTransition();

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <Card className="max-h-[70vh] space-y-2 overflow-y-auto">
        <form
          className="mb-3 space-y-2"
          action={(fd) =>
            start(async () => {
              const name = String(fd.get("name") ?? "Contact");
              const channel = String(fd.get("channel") ?? "website_chat") as Conversation["channel"];
              const r = await createConversationAction(companyId, channel, name);
              if (r.success) {
                toast.success("Thread created");
                setActiveId(r.id);
              }
            })
          }
        >
          <input name="name" placeholder="Participant" className={inputCls} />
          <select name="channel" className={inputCls}>
            <option value="website_chat">Website</option>
            <option value="email">Email</option>
            <option value="instagram">Instagram</option>
            <option value="facebook">Facebook</option>
            <option value="sms">SMS</option>
          </select>
          <Btn type="submit" disabled={pending}>New thread</Btn>
        </form>
        {conversations.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => {
              setActiveId(c.id);
              start(async () => {
                const { getMessagesAction } = await import("@/features/vande/actions");
                setMessages(await getMessagesAction(c.id));
              });
            }}
            className={`block w-full rounded-lg px-2 py-2 text-left text-sm ${
              activeId === c.id ? "bg-white/10" : "hover:bg-white/5"
            }`}
          >
            <p className="font-medium">{c.participant_name || c.subject || c.channel}</p>
            <p className="text-xs text-muted-foreground">{c.channel}</p>
          </button>
        ))}
      </Card>
      <Card className="flex max-h-[70vh] flex-col">
        <div className="flex-1 space-y-2 overflow-y-auto">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`rounded-lg px-3 py-2 text-sm ${
                m.direction === "outbound" ? "ml-8 bg-violet-600/20" : "mr-8 bg-white/5"
              }`}
            >
              {m.body}
              {m.ai_generated && (
                <span className="ml-2 text-[10px] text-violet-400">AI</span>
              )}
            </div>
          ))}
        </div>
        {activeId && (
          <div className="mt-3 flex flex-wrap gap-2 border-t border-white/10 pt-3">
            <input
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className={`flex-1 ${inputCls}`}
              placeholder="Reply..."
            />
            <Btn
              disabled={pending || !body.trim()}
              onClick={() =>
                start(async () => {
                  const r = await sendMessageAction(companyId, activeId, body);
                  if (r && "error" in r && r.error) toast.error(r.error);
                  else if (r && "warning" in r && r.warning) toast.warning(r.warning);
                  else toast.success("Sent");
                  setBody("");
                  const { getMessagesAction } = await import("@/features/vande/actions");
                  setMessages(await getMessagesAction(activeId));
                })
              }
            >
              Send
            </Btn>
            <Btn
              variant="ghost"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await aiSuggestReplyAction(companyId, activeId);
                  if (r.ok) setBody(r.reply);
                  else toast.error(r.error);
                })
              }
            >
              AI suggest
            </Btn>
          </div>
        )}
      </Card>
    </div>
  );
}

// ── Knowledge ──────────────────────────────────────────────────────────────
export function KnowledgeClient({
  docs,
  companyId,
}: {
  docs: KnowledgeDoc[];
  companyId?: string;
}) {
  const [pending, start] = useTransition();
  return (
    <div className="space-y-6">
      <Card>
        <h2 className="mb-3 text-sm font-medium">Add document / playbook / objection</h2>
        <form
          className="grid gap-2"
          action={(fd) =>
            start(async () => {
              if (companyId) fd.set("companyId", companyId);
              const r = await createKnowledgeDocAction(fd);
              if ("error" in r && r.error) toast.error(r.error);
              else toast.success("Saved");
            })
          }
        >
          <input name="title" placeholder="Title" required className={inputCls} />
          <select name="docType" className={inputCls}>
            <option value="general">General</option>
            <option value="playbook">Sales playbook</option>
            <option value="objection">Objection</option>
            <option value="faq">FAQ</option>
            <option value="product">Product</option>
          </select>
          <textarea name="content" rows={5} required className={inputCls} placeholder="Content" />
          <input name="tags" placeholder="tags,comma,separated" className={inputCls} />
          <Btn type="submit" disabled={pending}>Save</Btn>
        </form>
      </Card>
      <div className="grid gap-3 md:grid-cols-2">
        {docs.map((d) => (
          <Card key={d.id}>
            <p className="text-xs uppercase text-violet-400">{d.doc_type}</p>
            <h3 className="font-medium">{d.title}</h3>
            <p className="mt-2 line-clamp-4 text-sm text-muted-foreground">{d.content}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── Dashboards ─────────────────────────────────────────────────────────────
export function DashboardBuilderClient({
  widgets: initial,
  companyId,
  metrics,
}: {
  widgets: DashboardWidget[];
  companyId?: string;
  metrics: Record<string, number | string>;
}) {
  const [widgets, setWidgets] = useState(initial);
  const [pending, start] = useTransition();

  function renderWidget(w: DashboardWidget) {
    const value =
      w.type === "leads_count"
        ? metrics.leads
        : w.type === "customers_count"
          ? metrics.customers
          : w.type === "revenue"
            ? metrics.revenue
            : w.type === "ai_calls"
              ? metrics.aiCalls
              : w.type === "conversions"
                ? metrics.conversions
                : w.type === "pipeline"
                  ? metrics.pipelineOpen
                  : "—";
    return (
      <Card key={w.id} className="min-h-[100px]">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{w.title}</p>
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setWidgets((prev) => prev.filter((x) => x.id !== w.id))}
          >
            Remove
          </button>
        </div>
        <p className="text-2xl font-semibold">{value}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Btn
          disabled={pending}
          onClick={() =>
            start(async () => {
              await saveDashboardAction(widgets, companyId);
              toast.success("Layout saved");
            })
          }
        >
          Save layout
        </Btn>
        <Btn
          variant="ghost"
          onClick={() =>
            setWidgets((prev) => [
              ...prev,
              {
                id: `w-${Date.now()}`,
                type: "leads_count",
                title: "Leads",
                x: 0,
                y: 0,
                w: 3,
                h: 2,
              },
            ])
          }
        >
          + KPI widget
        </Btn>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {widgets.map(renderWidget)}
      </div>
    </div>
  );
}

// ── Automations ────────────────────────────────────────────────────────────
export function AutomationsClient({
  companyId,
  rules,
  sequences,
  webhooks,
}: {
  companyId: string;
  rules: AutomationRule[];
  sequences: Sequence[];
  webhooks: WebhookEndpoint[];
}) {
  const [pending, start] = useTransition();
  return (
    <div className="space-y-8">
      <Card>
        <h2 className="mb-3 text-sm font-medium">New automation rule</h2>
        <form
          className="grid gap-2 sm:grid-cols-3"
          action={(fd) =>
            start(async () => {
              const r = await createAutomationRuleAction(companyId, fd);
              if ("error" in r && r.error) toast.error(r.error);
              else toast.success("Rule created");
            })
          }
        >
          <input name="name" placeholder="Name" required className={inputCls} />
          <select name="triggerType" className={inputCls}>
            <option value="lead_created">Lead created</option>
            <option value="lead_status_changed">Lead status changed</option>
            <option value="missed_call">Missed call</option>
            <option value="appointment_upcoming">Appointment upcoming</option>
            <option value="webhook">Webhook</option>
          </select>
          <select name="actionType" className={inputCls}>
            <option value="route">Auto-route</option>
            <option value="ai_call">AI call</option>
            <option value="sms">SMS</option>
            <option value="notify">Notify</option>
            <option value="set_status">Set status</option>
            <option value="enroll_sequence">Enroll sequence</option>
          </select>
          <Btn type="submit" disabled={pending}>Create rule</Btn>
        </form>
      </Card>
      <div className="space-y-2">
        {rules.map((r) => (
          <Card key={r.id} className="flex items-center justify-between gap-2">
            <div>
              <p className="font-medium">{r.name}</p>
              <p className="text-xs text-muted-foreground">
                {r.trigger_type} · {r.is_active ? "active" : "paused"}
              </p>
            </div>
            <Btn
              variant="ghost"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  await toggleAutomationAction(companyId, r.id, !r.is_active);
                  toast.success("Updated");
                })
              }
            >
              {r.is_active ? "Pause" : "Enable"}
            </Btn>
          </Card>
        ))}
      </div>
      <Card>
        <h2 className="mb-3 text-sm font-medium">Follow-up sequence</h2>
        <form
          className="flex flex-wrap gap-2"
          action={(fd) =>
            start(async () => {
              const r = await createSequenceAction(companyId, fd);
              if ("error" in r && r.error) toast.error(r.error);
              else toast.success("Sequence created");
            })
          }
        >
          <input name="name" placeholder="Sequence name" required className={inputCls} />
          <Btn type="submit" disabled={pending}>Create (wait → AI call → SMS)</Btn>
        </form>
        <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
          {sequences.map((s) => (
            <li key={s.id}>{s.name}</li>
          ))}
        </ul>
      </Card>
      <Card>
        <h2 className="mb-3 text-sm font-medium">Webhook endpoint</h2>
        <form
          className="grid gap-2 sm:grid-cols-2"
          action={(fd) =>
            start(async () => {
              const r = await createWebhookEndpointAction(companyId, fd);
              if ("error" in r && r.error) toast.error(r.error);
              else toast.success("Webhook saved");
            })
          }
        >
          <input name="name" placeholder="Name" required className={inputCls} />
          <input name="url" placeholder="Outbound URL (optional)" className={inputCls} />
          <select name="direction" className={inputCls}>
            <option value="inbound">Inbound</option>
            <option value="outbound">Outbound</option>
          </select>
          <input name="events" placeholder="events (comma)" className={inputCls} />
          <Btn type="submit" disabled={pending}>Add webhook</Btn>
        </form>
        <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
          {webhooks.map((w) => (
            <li key={w.id}>
              {w.name} · {w.direction}
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <h2 className="mb-3 text-sm font-medium">Custom field</h2>
        <form
          className="grid gap-2 sm:grid-cols-3"
          action={(fd) =>
            start(async () => {
              const r = await createCustomFieldAction(companyId, fd);
              if ("error" in r && r.error) toast.error(r.error);
              else toast.success("Field created");
            })
          }
        >
          <input name="label" placeholder="Label" required className={inputCls} />
          <input name="fieldKey" placeholder="field_key" required className={inputCls} />
          <select name="objectType" className={inputCls}>
            <option value="lead">Lead</option>
            <option value="customer">Customer</option>
            <option value="appointment">Appointment</option>
          </select>
          <Btn type="submit" disabled={pending}>Add field</Btn>
        </form>
      </Card>
    </div>
  );
}
