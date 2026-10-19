import { NextResponse } from "next/server";
import { db } from "@/lib/db";

function parseJson<T>(value: string, fallback: T): T {
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const ticketId = Number(params.id);
  if (!Number.isInteger(ticketId) || ticketId <= 0) {
    return NextResponse.json({ error: "Ticket id must be a positive integer." }, { status: 400 });
  }

  const row = db.prepare(`
    SELECT
      t.id, t.title, t.body, t.source, t.status, t.urgency, t.created_at,
      tr.id AS triage_id, tr.classifier_output, tr.matched_rules, tr.sla_hours, tr.policy_notes, tr.action_plan,
      tr.draft_response, tr.webhook_payload, tr.approved, tr.approved_at, tr.created_at AS triaged_at
    FROM tickets t
    LEFT JOIN triage_results tr ON tr.ticket_id = t.id
    WHERE t.id = ?
  `).get(ticketId) as {
    id: number; title: string; body: string; source: string; status: string; urgency: string; created_at: string;
    triage_id?: number; classifier_output?: string; matched_rules?: string; sla_hours?: number; policy_notes?: string; action_plan?: string;
    draft_response?: string; webhook_payload?: string; approved?: number; approved_at?: string; triaged_at?: string;
  } | undefined;

  if (!row) return NextResponse.json({ error: "Ticket not found." }, { status: 404 });

  const { triage_id, classifier_output, matched_rules, sla_hours, policy_notes, action_plan, draft_response, webhook_payload, approved, approved_at, triaged_at, ...ticket } = row;
  const triage_result = triage_id ? {
    id: triage_id,
    classifier: parseJson(classifier_output ?? "{}", {}),
    matched_rules: parseJson(matched_rules ?? "[]", []),
    sla_hours: sla_hours ?? 48,
    policy_notes: policy_notes ?? "",
    action_plan: parseJson(action_plan ?? "[]", []),
    draft_response: draft_response ?? "",
    webhook_payload: parseJson(webhook_payload ?? "{}", {}),
    approved: approved === 1,
    created_at: triaged_at ?? null,
    approved_at: approved_at ?? null
  } : null;

  return NextResponse.json({ ticket, triage_result });
}
