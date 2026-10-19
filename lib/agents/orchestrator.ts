import { db } from "@/lib/db";
import { classifyTicket } from "./classifier";
import { applyPolicy } from "./policy";
import { dispatchAction } from "./dispatcher";
import type { TicketInput } from "./types";

type StoredTicket = TicketInput & { id: number };

function writeAgentLog(ticketId: number, agentName: string, message: string, level: "info" | "warn" | "error" = "info") {
  db.prepare("INSERT INTO agent_logs (ticket_id, agent_name, message, level) VALUES (?, ?, ?, ?)").run(ticketId, agentName, message, level);
}

export function runTriage(ticketId: number) {
  const ticket = db.prepare("SELECT id, title, body, source FROM tickets WHERE id = ?").get(ticketId) as StoredTicket | undefined;
  if (!ticket) return null;

  writeAgentLog(ticket.id, "Classifier Agent", `Classifier Agent started processing ticket #${ticket.id}`);
  const classifier = classifyTicket(ticket);
  writeAgentLog(ticket.id, "Classifier Agent", `Urgency detected: ${classifier.urgency} (confidence: ${Math.round(classifier.confidence * 100)}%)`);
  const policy = applyPolicy(classifier, ticket.source);
  writeAgentLog(ticket.id, "Policy Agent", `Policy Agent matched ${policy.matched_rules.length} SLA rules`);
  const dispatcher = dispatchAction(classifier, policy, ticket.body, ticket.title);
  writeAgentLog(ticket.id, "Action Dispatcher", `Action Dispatcher generated ${dispatcher.action_plan.length} action steps`);
  const webhook_payload = { ...dispatcher.webhook_payload, ticket_id: ticket.id };

  const save = db.transaction(() => {
    db.prepare(
      `INSERT INTO triage_results
        (ticket_id, classifier_output, matched_rules, sla_hours, policy_notes, action_plan, draft_response, webhook_payload, approved)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
       ON CONFLICT(ticket_id) DO UPDATE SET
        classifier_output = excluded.classifier_output,
        matched_rules = excluded.matched_rules,
        sla_hours = excluded.sla_hours,
        policy_notes = excluded.policy_notes,
        action_plan = excluded.action_plan,
        draft_response = excluded.draft_response,
        webhook_payload = excluded.webhook_payload,
        approved = 0,
        approved_at = NULL,
        created_at = CURRENT_TIMESTAMP`
    ).run(
      ticket.id,
      JSON.stringify(classifier),
      JSON.stringify(policy.matched_rules),
      policy.sla_hours,
      policy.policy_notes,
      JSON.stringify(dispatcher.action_plan),
      dispatcher.draft_response,
      JSON.stringify(webhook_payload)
    );
    db.prepare("UPDATE tickets SET status = 'triaged', urgency = ? WHERE id = ?").run(classifier.urgency, ticket.id);
  });
  save();
  writeAgentLog(ticket.id, "Orchestrator", "Triage complete — awaiting human approval");

  return {
    ticket_id: ticket.id,
    classifier,
    policy,
    dispatcher: { ...dispatcher, webhook_payload },
    status: "triaged" as const
  };
}
