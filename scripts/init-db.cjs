const fs = require("node:fs");
const path = require("node:path");
const Database = require("better-sqlite3");

const databasePath = process.env.DATABASE_PATH || "/app/data/pulsedesk.db";
fs.mkdirSync(path.dirname(databasePath), { recursive: true });

const db = new Database(databasePath);
db.pragma("foreign_keys = ON");
db.exec(fs.readFileSync("/app/db/schema.sql", "utf8"));

if (db.prepare("SELECT COUNT(*) AS count FROM tickets").get().count === 0) {
  const insert = db.prepare("INSERT INTO tickets (title, body, source, status, urgency) VALUES (?, ?, ?, ?, ?)");
  const tickets = [
    ["Production API is down", "All customer requests are failing with 503 errors since 09:12 UTC.", "alert", "open", "critical"],
    ["Checkout button throws an error", "The checkout form crashes after entering a valid card on Safari.", "bug", "open", "high"],
    ["Invoice total looks incorrect", "Our latest invoice includes a duplicate seat charge.", "billing", "open", "medium"],
    ["Background jobs are slow", "Report generation has taken more than 20 minutes for the last hour.", "alert", "open", "medium"],
    ["Request for dark mode", "Please consider adding a dark theme to the customer portal.", "bug", "open", "low"]
  ];
  db.transaction(() => tickets.forEach((ticket) => insert.run(...ticket)))();
}

if (db.prepare("SELECT COUNT(*) AS count FROM knowledge_base").get().count === 0) {
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
  db.transaction(() => rules.forEach((rule) => insert.run(...rule)))();
}

db.close();
console.log(`PulseDesk database ready at ${databasePath}`);
