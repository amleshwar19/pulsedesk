import { NextResponse } from "next/server";
import { db } from "@/lib/db";

const validSources = new Set(["bug", "billing", "alert"]);

export async function GET() {
  const rows = db.prepare(`
    SELECT t.*, COALESCE(tr.approved, 0) AS approved
    FROM tickets t
    LEFT JOIN triage_results tr ON tr.ticket_id = t.id
    ORDER BY datetime(t.created_at) DESC, t.id DESC
  `).all() as Array<Record<string, unknown> & { approved: number }>;
  const tickets = rows.map((ticket) => ({ ...ticket, approved: ticket.approved === 1 }));
  return NextResponse.json({ tickets });
}

export async function POST(request: Request) {
  let payload: { title?: unknown; body?: unknown; source?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const title = typeof payload.title === "string" ? payload.title.trim() : "";
  const body = typeof payload.body === "string" ? payload.body.trim() : "";
  const source = typeof payload.source === "string" ? payload.source : "";
  if (!title || !body || !validSources.has(source)) {
    return NextResponse.json({ error: "title, body, and a valid source are required." }, { status: 400 });
  }

  const result = db.prepare("INSERT INTO tickets (title, body, source) VALUES (?, ?, ?)").run(title, body, source);
  const ticket = db.prepare("SELECT * FROM tickets WHERE id = ?").get(result.lastInsertRowid);
  return NextResponse.json({ ticket }, { status: 201 });
}
