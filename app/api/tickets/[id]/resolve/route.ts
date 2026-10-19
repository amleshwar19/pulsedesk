import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PATCH(_request: Request, { params }: { params: { id: string } }) {
  const ticketId = Number(params.id);
  if (!Number.isInteger(ticketId) || ticketId <= 0) {
    return NextResponse.json({ error: "Ticket id must be a positive integer." }, { status: 400 });
  }

  const ticket = db.prepare(`
    SELECT t.id, t.status, COALESCE(tr.approved, 0) AS approved
    FROM tickets t LEFT JOIN triage_results tr ON tr.ticket_id = t.id
    WHERE t.id = ?
  `).get(ticketId) as { id: number; status: string; approved: number } | undefined;
  if (!ticket) return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
  if (ticket.status !== "triaged" || ticket.approved !== 1) {
    return NextResponse.json({ error: "Only triaged and approved tickets can be resolved." }, { status: 409 });
  }

  db.prepare("UPDATE tickets SET status = 'resolved' WHERE id = ?").run(ticketId);
  return NextResponse.json({ id: ticketId, status: "resolved" });
}
