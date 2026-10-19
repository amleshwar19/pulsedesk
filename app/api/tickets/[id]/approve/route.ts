import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const ticketId = Number(params.id);
  if (!Number.isInteger(ticketId) || ticketId <= 0) {
    return NextResponse.json({ error: "Ticket id must be a positive integer." }, { status: 400 });
  }

  let action = "approve";
  try {
    const payload = await request.json() as { action?: string };
    action = payload.action ?? action;
  } catch {
    // An empty body means approve, which keeps the endpoint convenient for clients.
  }

  const ticket = db.prepare("SELECT id FROM tickets WHERE id = ?").get(ticketId);
  if (!ticket) return NextResponse.json({ error: "Ticket not found." }, { status: 404 });

  if (action === "reject") {
    db.transaction(() => {
      db.prepare("DELETE FROM triage_results WHERE ticket_id = ?").run(ticketId);
      db.prepare("UPDATE tickets SET status = 'open' WHERE id = ?").run(ticketId);
    })();
    return NextResponse.json({ approved: false, status: "open", triage_result: null });
  }

  if (action !== "approve") return NextResponse.json({ error: "action must be approve or reject." }, { status: 400 });
  const triage = db.prepare("SELECT webhook_payload FROM triage_results WHERE ticket_id = ?").get(ticketId) as { webhook_payload: string } | undefined;
  if (!triage) return NextResponse.json({ error: "Ticket has not been triaged." }, { status: 409 });
  const approvedAt = new Date().toISOString();
  const result = db.prepare("UPDATE triage_results SET approved = 1, approved_at = ? WHERE ticket_id = ?").run(approvedAt, ticketId);
  if (result.changes === 0) return NextResponse.json({ error: "Unable to approve ticket." }, { status: 409 });

  let webhookPayload: unknown = triage.webhook_payload;
  try { webhookPayload = JSON.parse(triage.webhook_payload); } catch { /* Keep the raw payload in the log. */ }
  console.info(`[PulseDesk] Dispatch approved for ticket #${ticketId}`, { ticket_id: ticketId, approved_at: approvedAt, webhook_payload: webhookPayload });
  return NextResponse.json({ approved: true, status: "triaged", approved_at: approvedAt });
}
