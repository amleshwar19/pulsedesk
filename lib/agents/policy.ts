import { db } from "@/lib/db";
import type { ClassifierOutput, PolicyOutput } from "./types";

type KnowledgeRule = { category: string; rule_text: string; sla_hours: number };

export function applyPolicy(classifier: ClassifierOutput, source: string): PolicyOutput {
  const rules = db.prepare("SELECT category, rule_text, sla_hours FROM knowledge_base WHERE category IN (?, 'default') ORDER BY sla_hours ASC").all(source) as KnowledgeRule[];
  const urgencyTerms = classifier.urgency === "critical" ? ["critical"] : [classifier.urgency, "response", "investigated"];
  const specificRule = rules.find((rule) => urgencyTerms.some((term) => rule.rule_text.toLowerCase().includes(term)) && rule.category === source);
  const selected = specificRule ?? rules.find((rule) => rule.category === source) ?? rules[0];
  const matchedRules = rules.filter((rule) => rule.category === source && urgencyTerms.some((term) => rule.rule_text.toLowerCase().includes(term)));
  const effectiveRules = matchedRules.length ? matchedRules : selected ? [selected] : [];
  const sla_hours = selected?.sla_hours ?? 48;
  const policy_notes = `Applied ${source} policy for ${classifier.urgency} urgency. Target SLA: ${sla_hours} hour${sla_hours === 1 ? "" : "s"}.`;
  return { matched_rules: effectiveRules.map((rule) => rule.rule_text), sla_hours, policy_notes };
}
