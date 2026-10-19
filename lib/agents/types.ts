export type Urgency = "low" | "medium" | "high" | "critical";

export type TicketInput = {
  id?: number;
  title: string;
  body: string;
  source: "bug" | "billing" | "alert";
};

export type ClassifierOutput = {
  intent: string;
  urgency: Urgency;
  affected_components: string[];
  confidence: number;
};

export type PolicyOutput = {
  matched_rules: string[];
  sla_hours: number;
  policy_notes: string;
};

export type DispatcherOutput = {
  action_plan: string[];
  draft_response: string;
  webhook_payload: Record<string, unknown>;
};
