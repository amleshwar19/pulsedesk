import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const dataDir = path.join(process.cwd(), "data");
const databasePath = process.env.DATABASE_PATH ?? path.join(dataDir, "pulsedesk.db");

type GlobalWithDatabase = typeof globalThis & { pulsedeskDb?: Database.Database };

function createDatabase() {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  const db = new Database(databasePath);
  db.pragma("foreign_keys = ON");
  db.exec(fs.readFileSync(path.join(process.cwd(), "db", "schema.sql"), "utf8"));
  migrateDatabase(db);
  seedDatabase(db);
  return db;
}

function migrateDatabase(db: Database.Database) {
  const columns = db.prepare("PRAGMA table_info(triage_results)").all() as Array<{ name: string }>;
  if (!columns.some((column) => column.name === "webhook_payload")) {
    db.exec("ALTER TABLE triage_results ADD COLUMN webhook_payload TEXT NOT NULL DEFAULT '{}'");
  }
  if (!columns.some((column) => column.name === "approved_at")) {
    db.exec("ALTER TABLE triage_results ADD COLUMN approved_at TEXT");
  }
  if (!columns.some((column) => column.name === "matched_rules")) {
    db.exec("ALTER TABLE triage_results ADD COLUMN matched_rules TEXT NOT NULL DEFAULT '[]'");
  }
  if (!columns.some((column) => column.name === "sla_hours")) {
    db.exec("ALTER TABLE triage_results ADD COLUMN sla_hours INTEGER NOT NULL DEFAULT 48");
  }
}

function seedDatabase(db: Database.Database) {
  const ticketCount = db.prepare("SELECT COUNT(*) AS count FROM tickets").get() as { count: number };
  if (ticketCount.count === 0) {
    const insert = db.prepare(
      "INSERT INTO tickets (title, body, source, status, urgency) VALUES (?, ?, ?, ?, ?)"
    );
    const tickets = [
      ["Production API is down", "All customer requests are failing with 503 errors since 09:12 UTC.", "alert", "open", "critical"],
      ["Checkout button throws an error", "The checkout form crashes after entering a valid card on Safari.", "bug", "open", "high"],
      ["Invoice total looks incorrect", "Our latest invoice includes a duplicate seat charge.", "billing", "open", "medium"],
      ["Background jobs are slow", "Report generation has taken more than 20 minutes for the last hour.", "alert", "open", "medium"],
      ["Request for dark mode", "Please consider adding a dark theme to the customer portal.", "bug", "open", "low"]
    ];
    const transaction = db.transaction(() => tickets.forEach((ticket) => insert.run(...ticket)));
    transaction();
  }

  const ruleCount = db.prepare("SELECT COUNT(*) AS count FROM knowledge_base").get() as { count: number };
  if (ruleCount.count === 0) {
    const insert = db.prepare("INSERT INTO knowledge_base (category, rule_text, sla_hours) VALUES (?, ?, ?)");
    const rules = [
      ["alert", "Critical alerts require acknowledgement and mitigation within 1 hour.", 1],
      ["alert", "High-priority alerts require an owner within 4 hours.", 4],
      ["alert", "Medium-priority alerts should be investigated within 8 hours.", 8],
      ["bug", "Production bugs require an initial response within 8 hours.", 8],
      ["bug", "High-impact bugs should have a workaround within 12 hours.", 12],
      ["bug", "Low-impact bugs are reviewed in the next planning cycle.", 72],
      ["billing", "Billing disputes require a response within 24 hours.", 24],
      ["billing", "Duplicate charges should be investigated within 8 hours.", 8],
      ["billing", "Refund requests should be reviewed within 48 hours.", 48],
      ["default", "Uncategorized requests receive a response within 48 hours.", 48]
    ];
    const transaction = db.transaction(() => rules.forEach((rule) => insert.run(...rule)));
    transaction();
  }
}

const globalDatabase = globalThis as GlobalWithDatabase;
export const db = globalDatabase.pulsedeskDb ?? createDatabase();
if (process.env.NODE_ENV !== "production") globalDatabase.pulsedeskDb = db;

export default db;
