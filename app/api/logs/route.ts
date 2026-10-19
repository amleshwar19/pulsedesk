import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const logs = db.prepare(`
    SELECT l.id, l.ticket_id, l.agent_name, l.message, l.level, l.created_at, t.title AS ticket_title
    FROM agent_logs l
    INNER JOIN tickets t ON t.id = l.ticket_id
    ORDER BY datetime(l.created_at) DESC, l.id DESC
    LIMIT 20
  `).all();

  return NextResponse.json({ logs }, { headers: { "Cache-Control": "no-store" } });
}
