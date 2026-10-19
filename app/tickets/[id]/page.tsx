"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type Ticket = { id: number; title: string; body: string; source: string; status: string; urgency: string; created_at: string };
type TriageResult = {
  id: number;
  classifier: { intent: string; urgency: string; affected_components: string[]; confidence: number };
  matched_rules: string[];
  sla_hours: number;
  policy_notes: string;
  action_plan: string[];
  draft_response: string;
  webhook_payload: Record<string, unknown>;
  approved: boolean;
  created_at: string | null;
  approved_at: string | null;
};

const urgencyStyles: Record<string, string> = {
  critical: "border-red-500/30 bg-red-500/10 text-red-300",
  high: "border-orange-500/30 bg-orange-500/10 text-orange-300",
  medium: "border-yellow-500/30 bg-yellow-500/10 text-yellow-300",
  low: "border-green-500/30 bg-green-500/10 text-green-300"
};

function Badge({ children, className = "border-gray-700 bg-gray-800 text-gray-300" }: { children: React.ReactNode; className?: string }) {
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${className}`}>{children}</span>;
}

function Spinner() {
  return <span aria-label="Loading" className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-purple-200/30 border-t-purple-300" />;
}

export default function TicketDetailPage() {
  const params = useParams<{ id: string }>();
  const ticketId = params.id;
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [triage, setTriage] = useState<TriageResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadTicket = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/tickets/${ticketId}`, { cache: "no-store" });
      const data = await response.json() as { ticket?: Ticket; triage_result?: TriageResult; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to load ticket.");
      setTicket(data.ticket ?? null);
      setTriage(data.triage_result ?? null);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load ticket.");
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => { void loadTicket(); }, [loadTicket]);

  async function runTriage() {
    setWorking(true);
    try {
      const response = await fetch(`/api/tickets/${ticketId}/triage`, { method: "POST" });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to run triage.");
      await loadTicket();
      setNotice("Triage completed. Review the agent recommendations below.");
    } catch (runError) {
      setError(runError instanceof Error ? runError.message : "Unable to run triage.");
    } finally {
      setWorking(false);
    }
  }

  async function updateApproval(action: "approve" | "reject") {
    setWorking(true);
    try {
      const response = await fetch(`/api/tickets/${ticketId}/approve`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to update approval.");
      await loadTicket();
      setNotice(action === "approve" ? "Dispatch approved and recorded." : "Triage rejected. Ticket returned to the open queue.");
    } catch (approvalError) {
      setError(approvalError instanceof Error ? approvalError.message : "Unable to update approval.");
    } finally {
      setWorking(false);
    }
  }

  async function copyResponse() {
    if (!triage) return;
    await navigator.clipboard.writeText(triage.draft_response);
    setNotice("Draft response copied to clipboard.");
  }

  if (loading) return <main className="flex min-h-screen items-center justify-center bg-gray-950 text-gray-400"><div className="flex items-center gap-3"><Spinner /> Loading ticket...</div></main>;
  if (error || !ticket) return <main className="min-h-screen bg-gray-950 px-6 py-10 text-gray-100"><div className="mx-auto max-w-3xl rounded-xl border border-red-500/30 bg-red-500/10 p-6"><h1 className="text-xl font-semibold text-red-200">Unable to open ticket</h1><p className="mt-2 text-sm text-red-300">{error ?? "Ticket not found."}</p><Link href="/" className="mt-5 inline-block text-sm text-purple-300 hover:text-purple-200">← Back to dashboard</Link></div></main>;

  return (
    <main className="min-h-screen bg-gray-950 px-4 py-8 text-gray-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-center justify-between"><div><Link href="/" className="text-sm text-gray-500 transition hover:text-purple-300">← Back to dashboard</Link><div className="mt-4 flex items-center gap-3"><span className="font-mono text-sm text-purple-400">Ticket #{ticket.id}</span><Badge>{ticket.status}</Badge></div><h1 className="mt-2 text-3xl font-bold tracking-tight">{ticket.title}</h1></div><button type="button" onClick={() => void loadTicket()} className="text-sm text-gray-400 hover:text-purple-300">Refresh</button></div>
        {(notice || error) && <div role="status" className={`mb-6 rounded-lg border px-4 py-3 text-sm ${error ? "border-red-500/30 bg-red-500/10 text-red-200" : "border-green-500/30 bg-green-500/10 text-green-200"}`}>{error ?? notice}</div>}

        <div className="grid gap-6 lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.6fr)]">
          <section className="h-fit rounded-xl border border-gray-800 bg-gray-900 p-6"><div className="mb-5 flex items-center justify-between"><h2 className="text-lg font-semibold">Ticket info</h2><Badge className={urgencyStyles[ticket.urgency] ?? urgencyStyles.low}>{ticket.urgency}</Badge></div><div className="space-y-5"><div><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Customer report</p><p className="whitespace-pre-wrap text-sm leading-6 text-gray-300">{ticket.body}</p></div><dl className="grid grid-cols-2 gap-4 border-t border-gray-800 pt-5"><div><dt className="text-xs text-gray-500">Source</dt><dd className="mt-1 capitalize text-sm text-gray-200">{ticket.source}</dd></div><div><dt className="text-xs text-gray-500">Status</dt><dd className="mt-1 capitalize text-sm text-gray-200">{ticket.status}</dd></div><div className="col-span-2"><dt className="text-xs text-gray-500">Created at</dt><dd className="mt-1 text-sm text-gray-300">{ticket.created_at}</dd></div></dl>{!triage && <button type="button" disabled={working} onClick={() => void runTriage()} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-purple-500 disabled:cursor-not-allowed disabled:opacity-60">{working && <Spinner />}{working ? "Running triage..." : "Run Triage"}</button>}</div></section>

          {triage ? <section className="space-y-5"><h2 className="text-lg font-semibold">Agent pipeline inspector</h2><article className="rounded-xl border border-blue-500/20 bg-gray-900 p-6"><div className="mb-5 flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-500/15 text-lg">🔵</span><div><p className="text-xs uppercase tracking-wider text-blue-300">Step 1</p><h3 className="font-semibold">Classifier Agent</h3></div></div><div className="grid gap-5 sm:grid-cols-2"><div><p className="text-xs text-gray-500">Detected intent</p><p className="mt-1 capitalize text-gray-200">{triage.classifier.intent.replaceAll("_", " ")}</p></div><div><p className="text-xs text-gray-500">Urgency</p><p className="mt-1 capitalize text-gray-200">{triage.classifier.urgency}</p></div><div className="sm:col-span-2"><p className="mb-2 text-xs text-gray-500">Affected components</p><div className="flex flex-wrap gap-2">{triage.classifier.affected_components.map((component) => <Badge key={component} className="border-blue-500/20 bg-blue-500/10 text-blue-200">{component}</Badge>)}</div></div><div className="sm:col-span-2"><div className="mb-2 flex justify-between text-xs"><span className="text-gray-500">Confidence</span><span className="text-blue-300">{Math.round(triage.classifier.confidence * 100)}%</span></div><div className="h-2 overflow-hidden rounded-full bg-gray-800"><div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${Math.min(100, Math.max(0, triage.classifier.confidence * 100))}%` }} /></div></div></div></article>

            <article className="rounded-xl border border-yellow-500/20 bg-gray-900 p-6"><div className="mb-5 flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-yellow-500/15 text-lg">🟡</span><div><p className="text-xs uppercase tracking-wider text-yellow-300">Step 2</p><h3 className="font-semibold">Policy &amp; Context Agent</h3></div></div><div className="space-y-4"><div className="flex items-center justify-between rounded-lg bg-gray-950/60 px-4 py-3"><span className="text-sm text-gray-400">Target SLA</span><span className="font-semibold text-yellow-200">{triage.sla_hours} hour{triage.sla_hours === 1 ? "" : "s"}</span></div><div><p className="mb-2 text-xs text-gray-500">Matched SLA rules</p><ul className="space-y-2">{triage.matched_rules.map((rule) => <li key={rule} className="flex gap-2 text-sm text-gray-300"><span className="text-yellow-400">✓</span><span>{rule}</span></li>)}</ul></div><p className="rounded-lg border border-gray-800 bg-gray-950/50 p-3 text-sm leading-6 text-gray-400">{triage.policy_notes}</p></div></article>

            <article className="rounded-xl border border-orange-500/20 bg-gray-900 p-6"><div className="mb-5 flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-full bg-orange-500/15 text-lg">🟠</span><div><p className="text-xs uppercase tracking-wider text-orange-300">Step 3</p><h3 className="font-semibold">Action Dispatcher</h3></div></div><div className="space-y-5"><div><p className="mb-3 text-xs text-gray-500">Action plan</p><ol className="space-y-3">{triage.action_plan.map((step, index) => <li key={step} className="flex gap-3 text-sm text-gray-300"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-500/10 text-xs font-semibold text-orange-300">{index + 1}</span><span className="pt-1">{step}</span></li>)}</ol></div><div><div className="mb-2 flex items-center justify-between"><p className="text-xs text-gray-500">Draft response</p><button type="button" onClick={() => void copyResponse()} className="text-xs text-purple-300 hover:text-purple-200">Copy</button></div><textarea readOnly value={triage.draft_response} rows={8} className="w-full resize-y rounded-lg border border-gray-800 bg-gray-950 p-3 text-sm leading-6 text-gray-300 outline-none" /></div><div><p className="mb-2 text-xs text-gray-500">Webhook payload</p><pre className="max-h-72 overflow-auto rounded-lg bg-gray-800 p-4 text-xs leading-6 text-orange-200">{JSON.stringify(triage.webhook_payload, null, 2)}</pre></div></div></article>
          </section> : <section className="flex min-h-[360px] items-center justify-center rounded-xl border border-dashed border-gray-800 bg-gray-900/50 p-8 text-center"><div><div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-purple-500/10 text-2xl">✦</div><h2 className="text-lg font-semibold">Pipeline waiting to run</h2><p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-gray-500">Run triage to inspect the classifier, policy, and dispatcher recommendations for this ticket.</p></div></section>}
        </div>

        {triage && <section className="mt-6 rounded-xl border border-gray-800 bg-gray-900 p-6"><div className="mb-4 flex items-center gap-3"><div className="h-2 w-2 rounded-full bg-purple-400" /><h2 className="text-lg font-semibold">Human-in-the-loop approval</h2></div>{triage.approved ? <div className="flex flex-col gap-2 rounded-lg border border-green-500/25 bg-green-500/10 px-4 py-4 text-green-200 sm:flex-row sm:items-center sm:justify-between"><span>✅ Dispatched — the triage plan was approved and recorded.</span><span className="text-xs text-green-300/70">{triage.approved_at ?? "Just now"}</span></div> : <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-sm text-gray-400">Review the generated plan before dispatching it to the owning team.</p><div className="flex gap-3"><button type="button" disabled={working} onClick={() => void updateApproval("reject")} className="rounded-lg border border-red-500/30 px-4 py-2.5 text-sm font-semibold text-red-300 transition hover:bg-red-500/10 disabled:opacity-50">❌ Reject</button><button type="button" disabled={working} onClick={() => void updateApproval("approve")} className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-500 disabled:opacity-50">{working && <Spinner />}✅ Approve &amp; Dispatch</button></div></div>}</section>}
      </div>
    </main>
  );
}
