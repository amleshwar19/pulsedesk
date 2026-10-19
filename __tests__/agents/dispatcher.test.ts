import { dispatchAction } from "@/lib/agents/dispatcher";
import type { ClassifierOutput, PolicyOutput } from "@/lib/agents/types";

const classifier: ClassifierOutput = {
  intent: "billing",
  urgency: "high",
  affected_components: ["payments"],
  confidence: 0.92
};

const policy: PolicyOutput = {
  matched_rules: ["Billing disputes require a response within 24 hours."],
  sla_hours: 24,
  policy_notes: "Apply billing policy."
};

describe("action dispatcher", () => {
  it("generates a non-empty action plan", () => {
    const result = dispatchAction(classifier, policy, "The invoice has a duplicate charge.", "Invoice dispute");

    expect(Array.isArray(result.action_plan)).toBe(true);
    expect(result.action_plan.length).toBeGreaterThan(0);
  });

  it("includes the ticket title in the draft response", () => {
    const result = dispatchAction(classifier, policy, "The invoice has a duplicate charge.", "Invoice dispute");

    expect(result.draft_response).toContain("Invoice dispute");
  });

  it("includes the required webhook payload fields", () => {
    const result = dispatchAction(classifier, policy, "The invoice has a duplicate charge.", "Invoice dispute");

    expect(result.webhook_payload).toEqual(expect.objectContaining({ type: expect.any(String), urgency: "high" }));
    expect(result.webhook_payload).toHaveProperty("ticket_id");
  });
});
