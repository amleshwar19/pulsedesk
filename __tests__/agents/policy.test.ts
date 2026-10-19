import { applyPolicy } from "@/lib/agents/policy";
import type { ClassifierOutput } from "@/lib/agents/types";

const classifier = (urgency: ClassifierOutput["urgency"]): ClassifierOutput => ({
  intent: "service_incident",
  urgency,
  affected_components: ["infrastructure"],
  confidence: 0.98
});

describe("policy and context agent", () => {
  it("matches the one-hour SLA for a critical alert", () => {
    const result = applyPolicy(classifier("critical"), "alert");

    expect(result.sla_hours).toBe(1);
    expect(result.matched_rules).toEqual(expect.arrayContaining([expect.stringContaining("1 hour")]));
  });

  it("uses the default fallback rule for an unknown category", () => {
    const result = applyPolicy(classifier("low"), "unknown");

    expect(result.sla_hours).toBe(48);
    expect(result.matched_rules).toEqual(expect.arrayContaining([expect.stringContaining("Uncategorized")]));
  });
});
