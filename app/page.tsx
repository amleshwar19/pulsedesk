"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type Ticket = {
  id: number;
  title: string;
  body: string;
  source: "bug" | "billing" | "alert";
  status: "open" | "triaged" | "resolved";
  urgency: "low" | "medium" | "high" | "critical";
  approved: boolean;
  created_at: string;
};

type ActivityLog = {
  id: number;
  ticket_id: number;
  ticket_title: string;
  agent_name: string;
  message: string;
  level: "info" | "warn" | "error";
  created_at: string;
};

const urgencyStyles: Record<Ticket["urgency"], string> = {
  critical: "border-red-500/30 bg-red-500/10 text-red-300",
  high: "border-orange-500/30 bg-orange-500/10 text-orange-300",
  medium: "border-yellow-500/30 bg-yellow-500/10 text-yellow-300",
  low: "border-green-500/30 bg-green-500/10 text-green-300"
};
const urgencyRank: Record<Ticket["urgency"], number> = { critical: 0, high: 1, medium: 2, low: 3 };
const sourceStyles: Record<Ticket["source"], string> = {
  bug: "border-blue-500/30 bg-blue-500/10 text-blue-300",
  billing: "border-purple-500/30 bg-purple-500/10 text-purple-300",
  alert: "border-red-500/30 bg-red-500/10 text-red-300"
};
const logLevelStyles: Record<ActivityLog["level"], string> = {
  info: "border-gray-700 bg-gray-800 text-gray-300",
  warn: "border-yellow-500/30 bg-yellow-500/10 text-yellow-300",
  error: "border-red-500/30 bg-red-500/10 text-red-300"
};

function Badge({ children, className }: { children: React.ReactNode; className: string }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${className}`}>{children}</span>;
}

function Spinner() {
  return <span aria-label="Loading" className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-purple-200/30 border-t-purple-300" />;
}

function timeAgo(timestamp: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function Dashboard() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [triagingId, setTriagingId] = useState<number | null>(null);
  const [resolvingId, setResolvingId] = useState<number | null>(null);
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [form, setForm] = useState({ title: "", body: "", source: "bug" as Ticket["source"] });

  const loadTickets = useCallback(async () => {
    try {
      const response = await fetch("/api/tickets", { cache: "no-store" });
      if (!response.ok) throw new Error("Unable to load tickets");
      const data = await response.json() as { tickets: Ticket[] };
      setTickets([...data.tickets].sort((left, right) => urgencyRank[left.urgency] - urgencyRank[right.urgency] || right.id - left.id));
    } catch {
      setToast({ type: "error", message: "Could not load tickets. Please try again." });
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLogs = useCallback(async () => {
    try {
      const response = await fetch("/api/logs", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json() as { logs: ActivityLog[] };
      setLogs(data.logs);
    } catch {
      // The feed is auxiliary; keep the ticket queue usable if it is unavailable.
    }
  }, []);

  useEffect(() => { void loadTickets(); }, [loadTickets]);
  useEffect(() => {
    void loadLogs();
    const interval = window.setInterval(() => { void loadLogs(); }, 5000);
    return () => window.clearInterval(interval);
  }, [loadLogs]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const stats = useMemo(() => ({
    open: tickets.filter((ticket) => ticket.status === "open").length,
    triaged: tickets.filter((ticket) => ticket.status === "triaged").length,
    resolved: tickets.filter((ticket) => ticket.status === "resolved").length,
    critical: tickets.filter((ticket) => ticket.urgency === "critical").length
  }), [tickets]);

  async function triageTicket(ticketId: number) {
    setTriagingId(ticketId);
    try {
      const response = await fetch(`/api/tickets/${ticketId}/triage`, { method: "POST" });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Triage failed");
      await Promise.all([loadTickets(), loadLogs()]);
      setToast({ type: "success", message: `Ticket #${ticketId} triaged successfully.` });
    } catch (error) {
      setToast({ type: "error", message: error instanceof Error ? error.message : "Unable to triage ticket." });
    } finally {
      setTriagingId(null);
    }
  }

  async function resolveTicket(ticketId: number) {
    setResolvingId(ticketId);
    try {
      const response = await fetch(`/api/tickets/${ticketId}/resolve`, { method: "PATCH" });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to resolve ticket.");
      await loadTickets();
      setToast({ type: "success", message: `Ticket #${ticketId} marked as resolved.` });
    } catch (error) {
      setToast({ type: "error", message: error instanceof Error ? error.message : "Unable to resolve ticket." });
    } finally {
      setResolvingId(null);
    }
  }

  async function createTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const response = await fetch("/api/tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to create ticket");
      setForm({ title: "", body: "", source: "bug" });
      setShowNewTicket(false);
      await loadTickets();
      setToast({ type: "success", message: "New ticket created." });
    } catch (error) {
      setToast({ type: "error", message: error instanceof Error ? error.message : "Unable to create ticket." });
    } finally {
      setSubmitting(false);
    }
  }

  function handleRowKeyDown(event: React.KeyboardEvent<HTMLTableRowElement>, ticket: Ticket) {
    if (event.key.toLowerCase() !== "t" || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey || triagingId !== null || ticket.status === "resolved") return;
    event.preventDefault();
    void triageTicket(ticket.id);
  }

  return (
    <main className="min-h-screen bg-gray-950 px-4 py-8 text-gray-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-600 text-xl shadow-lg shadow-purple-900/30">✦</div><p className="text-xl font-bold tracking-tight">PulseDesk</p></div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Autonomous Multi-Agent Triage</h1>
            <p className="mt-2 text-gray-400">Monitor, classify, and resolve support signals from one command center.</p>
          </div>
          <button type="button" onClick={() => setShowNewTicket((visible) => !visible)} className="rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 focus:ring-offset-gray-950">{showNewTicket ? "Close form" : "+ New Ticket"}</button>
        </header>

        {toast && <div role="status" className={`mb-6 flex items-center justify-between rounded-lg border px-4 py-3 text-sm ${toast.type === "success" ? "border-green-500/30 bg-green-500/10 text-green-200" : "border-red-500/30 bg-red-500/10 text-red-200"}`}><span>{toast.message}</span><button type="button" onClick={() => setToast(null)} className="ml-4 text-current/70 hover:text-current" aria-label="Dismiss notification">×</button></div>}

        {showNewTicket && <form onSubmit={createTicket} className="mb-8 rounded-xl border border-purple-500/20 bg-gray-900 p-5 shadow-xl shadow-purple-950/10"><div className="mb-5"><h2 className="font-semibold">Create a new ticket</h2><p className="mt-1 text-sm text-gray-400">Add an incoming signal for the triage pipeline.</p></div><div className="grid gap-4 md:grid-cols-2"><label className="block"><span className="mb-2 block text-sm font-medium text-gray-300">Title</span><input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="e.g. Production API is unavailable" className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2.5 text-sm outline-none placeholder:text-gray-600 focus:border-purple-500 focus:ring-1 focus:ring-purple-500" /></label><label className="block"><span className="mb-2 block text-sm font-medium text-gray-300">Source</span><select value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value as Ticket["source"] })} className="w-full rounded-lg border border-gray-700 bg-gray-950 px-3 py-2.5 text-sm capitalize outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"><option value="bug">Bug</option><option value="billing">Billing</option><option value="alert">Alert</option></select></label><label className="block md:col-span-2"><span className="mb-2 block text-sm font-medium text-gray-300">Body</span><textarea required rows={4} value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} placeholder="Describe the customer issue or system signal..." className="w-full resize-y rounded-lg border border-gray-700 bg-gray-950 px-3 py-2.5 text-sm outline-none placeholder:text-gray-600 focus:border-purple-500 focus:ring-1 focus:ring-purple-500" /></label></div><div className="mt-4 flex justify-end"><button disabled={submitting} type="submit" className="inline-flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-60">{submitting && <Spinner />}{submitting ? "Creating..." : "Create Ticket"}</button></div></form>}

        <section className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[{ label: "Open", value: stats.open, hint: "Awaiting triage", tone: "text-blue-300" }, { label: "Triaged", value: stats.triaged, hint: "Ready for review", tone: "text-purple-300" }, { label: "Resolved", value: stats.resolved, hint: "Closed successfully", tone: "text-green-300" }, { label: "Critical", value: stats.critical, hint: "Needs immediate attention", tone: "text-red-300" }].map((stat) => <div key={stat.label} className="rounded-xl border border-gray-800 bg-gray-900 p-5"><div className="flex items-start justify-between"><p className="text-sm text-gray-400">{stat.label}</p><span className={`h-2 w-2 rounded-full bg-current ${stat.tone}`} /></div><p className={`mt-3 text-3xl font-bold ${stat.tone}`}>{loading ? "—" : stat.value}</p><p className="mt-1 text-xs text-gray-500">{stat.hint}</p></div>)}
        </section>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="overflow-hidden rounded-xl border border-gray-800 bg-gray-900 shadow-2xl shadow-black/20"><div className="flex items-center justify-between border-b border-gray-800 px-5 py-4"><div><h2 className="font-semibold">Ticket queue</h2><p className="mt-1 text-xs text-gray-500">Critical tickets are prioritized automatically · press <kbd className="rounded border border-gray-700 bg-gray-800 px-1.5 py-0.5 text-[10px] text-gray-300">T</kbd> on a row to triage</p></div><button type="button" onClick={() => void loadTickets()} className="text-sm text-gray-400 transition hover:text-purple-300">Refresh</button></div><div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm"><thead className="bg-gray-800/40 text-xs uppercase tracking-wider text-gray-500"><tr>{["ID", "Title", "Source", "Urgency", "Status", "Created At", "Actions"].map((heading) => <th key={heading} className="px-5 py-3 font-medium">{heading}</th>)}</tr></thead><tbody>{loading ? Array.from({ length: 5 }, (_, index) => <tr key={index} className="border-t border-gray-800"><td colSpan={7} className="px-5 py-4"><div className="h-5 animate-pulse rounded bg-gray-800" /></td></tr>) : tickets.length === 0 ? <tr><td colSpan={7} className="px-5 py-12 text-center text-gray-500">No tickets yet. Create one to start the triage pipeline.</td></tr> : tickets.map((ticket) => <tr key={ticket.id} tabIndex={0} onKeyDown={(event) => handleRowKeyDown(event, ticket)} className="border-t border-gray-800 outline-none transition hover:bg-gray-800/30 focus:bg-purple-500/5 focus:ring-1 focus:ring-inset focus:ring-purple-500"><td className="px-5 py-4 font-mono text-xs text-gray-500">#{ticket.id}</td><td className="max-w-xs px-5 py-4 font-medium text-gray-200">{ticket.title}</td><td className="px-5 py-4"><Badge className={sourceStyles[ticket.source]}>{ticket.source}</Badge></td><td className="px-5 py-4"><Badge className={urgencyStyles[ticket.urgency]}>{ticket.urgency}</Badge></td><td className="px-5 py-4"><span className="capitalize text-gray-300">{ticket.status}</span>{ticket.approved && ticket.status === "triaged" && <span className="ml-2 text-xs text-green-400">Approved</span>}</td><td className="whitespace-nowrap px-5 py-4 text-xs text-gray-500">{ticket.created_at}</td><td className="px-5 py-4"><div className="flex items-center gap-3"><button type="button" disabled={triagingId !== null || ticket.status === "resolved"} onClick={() => void triageTicket(ticket.id)} className="inline-flex min-w-[102px] items-center justify-center gap-2 rounded-md border border-purple-500/40 px-3 py-1.5 text-xs font-semibold text-purple-300 transition hover:bg-purple-500/10 disabled:cursor-not-allowed disabled:opacity-50">{triagingId === ticket.id && <Spinner />}{triagingId === ticket.id ? "Triaging..." : "Triage Now"}</button>{ticket.status === "triaged" && ticket.approved && <button type="button" disabled={resolvingId !== null} onClick={() => void resolveTicket(ticket.id)} className="inline-flex min-w-[82px] items-center justify-center gap-2 rounded-md border border-green-500/40 px-3 py-1.5 text-xs font-semibold text-green-300 transition hover:bg-green-500/10 disabled:cursor-not-allowed disabled:opacity-50">{resolvingId === ticket.id && <Spinner />}{resolvingId === ticket.id ? "Resolving..." : "Resolve"}</button>}<Link className="text-xs font-medium text-gray-400 transition hover:text-purple-300" href={`/tickets/${ticket.id}`}>View</Link></div></td></tr>)}</tbody></table></div></section>

          <aside className="h-fit rounded-xl border border-gray-800 bg-gray-900 shadow-2xl shadow-black/20 lg:sticky lg:top-6"><div className="flex items-center justify-between border-b border-gray-800 px-5 py-4"><div><h2 className="font-semibold">Activity Feed</h2><p className="mt-1 text-xs text-gray-500">Live agent events · refreshes every 5s</p></div><span className="h-2 w-2 animate-pulse rounded-full bg-green-400" /></div><div className="max-h-[620px] divide-y divide-gray-800 overflow-y-auto">{logs.length === 0 ? <div className="px-5 py-10 text-center text-sm text-gray-500">No agent activity yet. Run triage on a ticket to see events here.</div> : logs.map((log) => <div key={log.id} className="px-5 py-4"><div className="mb-2 flex items-center justify-between gap-2"><span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${logLevelStyles[log.level]}`}>{log.agent_name}</span><span className="shrink-0 text-[10px] text-gray-600">{timeAgo(log.created_at)}</span></div><p className="text-xs leading-5 text-gray-300">{log.message}</p><Link href={`/tickets/${log.ticket_id}`} className="mt-2 inline-block text-[11px] text-purple-400 hover:text-purple-300">#{log.ticket_id} · {log.ticket_title}</Link></div>)}</div></aside>
        </div>
      </div>
    </main>
  );
}
