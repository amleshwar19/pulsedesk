import type { ClassifierOutput, TicketInput, Urgency } from "./types";

const urgencyRules: Array<{ urgency: Urgency; keywords: string[] }> = [
  { urgency: "critical", keywords: ["down", "outage", "critical", "production is failing", "unavailable", "data loss"] },
  { urgency: "high", keywords: ["failed", "failure", "broken", "error", "security", "urgent"] },
  { urgency: "medium", keywords: ["slow", "delay", "degraded", "incorrect", "duplicate"] }
];

const componentKeywords: Array<{ component: string; keywords: string[] }> = [
  { component: "api", keywords: ["api", "endpoint", "request", "503", "service"] },
  { component: "infrastructure", keywords: ["server", "production", "outage", "down", "deploy"] },
  { component: "payments", keywords: ["payment", "card", "checkout", "invoice", "billing", "refund", "charge"] },
  { component: "background-jobs", keywords: ["job", "queue", "worker", "report generation"] },
  { component: "web-frontend", keywords: ["browser", "safari", "button", "portal", "ui", "dark mode"] }
];

export function classifyTicket(ticket: Pick<TicketInput, "title" | "body" | "source">): ClassifierOutput {
  const text = `${ticket.title} ${ticket.body}`.toLowerCase();
  const urgencyRule = urgencyRules.find((rule) => rule.keywords.some((keyword) => text.includes(keyword)));
  const urgency = urgencyRule?.urgency ?? "low";

  let intent = ticket.source;
  if (ticket.source === "billing" || /invoice|refund|charge|payment/.test(text)) intent = "billing";
  else if (/security|breach|unauthorized|access/.test(text)) intent = "security_incident";
  else if (ticket.source === "alert" || /outage|down|latency|slow|degraded/.test(text)) intent = "service_incident";
  else if (/feature|request|consider|would like/.test(text)) intent = "feature_request";
  else if (ticket.source === "bug" || /bug|error|broken|crash|fails/.test(text)) intent = "software_bug";

  const affected_components = componentKeywords
    .filter(({ keywords }) => keywords.some((keyword) => text.includes(keyword)))
    .map(({ component }) => component);

  const confidence = urgencyRule ? (urgency === "critical" ? 0.98 : urgency === "high" ? 0.92 : 0.84) : 0.68;
  return { intent, urgency, affected_components: affected_components.length ? affected_components : [ticket.source], confidence };
}
