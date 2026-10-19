import type { ClassifierOutput, DispatcherOutput, PolicyOutput, Urgency } from "./types";

export function dispatchAction(
  classifier: ClassifierOutput,
  policy: PolicyOutput,
  ticketBody: string,
  ticketTitle = "your support request"
): DispatcherOutput {
  const action_plan: string[] = [
    `Assign the ${classifier.intent} ticket to the ${classifier.urgency} response queue.`,
    `Notify the owning team for ${classifier.affected_components.join(", ")}.`,
    `Acknowledge the customer within ${policy.sla_hours} hour${policy.sla_hours === 1 ? "" : "s"}.`
  ];
  if (classifier.urgency === "critical" || classifier.urgency === "high") {
    action_plan.push("Open an incident channel and record mitigation progress.");
  }
  if (classifier.intent === "billing") action_plan.push("Verify the account ledger and prepare any eligible credit or refund.");

  const draft_response = `Hello,\n\nWe received your request, “${ticketTitle}”. Our team has classified it as a ${classifier.urgency}-priority ${classifier.intent.replaceAll("_", " ")} and is reviewing it now. We will provide an update within ${policy.sla_hours} hour${policy.sla_hours === 1 ? "" : "s"}.\n\nSummary: ${ticketBody}\n\nThank you,\nPulseDesk Support`;
  const webhook_payload = {
    type: "pulsedesk.triage.created",
    ticket_id: null,
    urgency: classifier.urgency as Urgency,
    intent: classifier.intent,
    sla_hours: policy.sla_hours,
    affected_components: classifier.affected_components,
    summary: `New ${classifier.urgency} ${classifier.intent} ticket requires triage.`
  };
  return { action_plan, draft_response, webhook_payload };
}
