import { NextResponse } from "next/server";
import { runTriage } from "@/lib/agents/orchestrator";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const ticketId = Number(params.id);
  if (!Number.isInteger(ticketId) || ticketId <= 0) {
    return NextResponse.json({ error: "Ticket id must be a positive integer." }, { status: 400 });
  }

  try {
    const result = runTriage(ticketId);
    if (!result) return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Triage pipeline failed", error);
    return NextResponse.json({ error: "Unable to triage ticket." }, { status: 500 });
  }
}
