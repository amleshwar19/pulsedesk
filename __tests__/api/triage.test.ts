import { POST as createTicket } from "@/app/api/tickets/route";
import { POST as triageTicket } from "@/app/api/tickets/[id]/triage/route";
import { db } from "@/lib/db";

describe("triage API integration", () => {
  beforeEach(() => {
    db.exec("DELETE FROM agent_logs; DELETE FROM triage_results; DELETE FROM tickets;");
  });

  it("creates a ticket, triages it, and records the result and agent logs", async () => {
    const createResponse = await createTicket(new Request("http://localhost/api/tickets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Production server outage",
        body: "The server is down and customers are seeing an outage.",
        source: "alert"
      })
    }));
    const created = await createResponse.json() as { ticket: { id: number } };

    expect(createResponse.status).toBe(201);

    const triageResponse = await triageTicket(new Request(`http://localhost/api/tickets/${created.ticket.id}/triage`, { method: "POST" }), {
      params: { id: String(created.ticket.id) }
    });
    const triage = await triageResponse.json() as { classifier: { urgency: string } };

    expect(triageResponse.status).toBe(200);
    expect(triage.classifier.urgency).toBe("critical");

    const saved = db.prepare("SELECT classifier_output FROM triage_results WHERE ticket_id = ?").get(created.ticket.id) as { classifier_output: string } | undefined;
    const logs = db.prepare("SELECT COUNT(*) AS count FROM agent_logs WHERE ticket_id = ?").get(created.ticket.id) as { count: number };

    expect(saved).toBeDefined();
    expect(JSON.parse(saved!.classifier_output).urgency).toBe("critical");
    expect(logs.count).toBeGreaterThanOrEqual(4);
  });
});
