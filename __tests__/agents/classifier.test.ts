import { classifyTicket } from "@/lib/agents/classifier";

describe("classifier agent", () => {
  it("detects a production outage as critical", () => {
    const result = classifyTicket({
      title: "Server is down",
      body: "The server is down and production outage is affecting all customers.",
      source: "alert"
    });

    expect(result.urgency).toBe("critical");
  });

  it("detects billing intent from an invoice question", () => {
    const result = classifyTicket({
      title: "Billing invoice question",
      body: "Why does this invoice include an extra charge?",
      source: "billing"
    });

    expect(result.intent).toBe("billing");
  });

  it("returns confidence between zero and one", () => {
    const result = classifyTicket({ title: "General question", body: "Can you help?", source: "bug" });

    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });
});
