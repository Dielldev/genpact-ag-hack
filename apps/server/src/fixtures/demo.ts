import { Client, DecisionArea, ReportStatus, Visibility, type ReportProgressInput, type TurnPing } from "@mesh/contract";
import { BANK_WS, DEV_WS, martaHistory, report } from "./billing.js";

export const PRIVATE_MARKER = "PRIVATE-KAI";
export const BANKER_MARKERS = ["Falcon", "Halvorsen"];

export interface SeedTicket {
  workspace: string;
  ref: string;
  title: string;
  description: string;
  assignee: string;
  created_by: string;
}

export interface Seed {
  pings: TurnPing[];
  reports: ReportProgressInput[];
  tickets: SeedTicket[];
}

const ping = (person: string, session_id: string, project: string, visibility = Visibility.shared, client = Client.claudeCode, workspace = DEV_WS): TurnPing => ({
  client,
  session_id,
  person,
  workspace,
  project,
  visibility,
  ts: new Date().toISOString(),
});

export function demoSeed(): Seed {
  return {
    tickets: [
      { workspace: DEV_WS, ref: "BILL-142", title: "Exponential backoff for billing retries", description: "Replace the fixed retry schedule with exponential backoff and jitter.", assignee: "Ana Lee", created_by: "Ana Lee" },
      { workspace: DEV_WS, ref: "BILL-150", title: "Stripe webhook handler", description: "Handle Stripe payment webhooks and update invoices.", assignee: "Bo Chen", created_by: "Bo Chen" },
      { workspace: DEV_WS, ref: "AUTH-31", title: "Signed cookie sessions", description: "Move sessions from the DB table to signed cookies.", assignee: "Jules Moreau", created_by: "Jules Moreau" },
      { workspace: BANK_WS, ref: "FALCON-7", title: "Project Falcon comps refresh", description: "Refresh trading comps for the Falcon model.", assignee: "Mara Okafor", created_by: "Mara Okafor" },
    ],
    pings: [
      ping("Noor Haddad", "noor-mobile-1", "mobile-app"),
      ping("Kai Brennan", "kai-private-1", "people-ops", Visibility.private),
      ping("Ana Lee", "ana-retry-1", "billing-service"),
      ping("Jules Moreau", "jules-auth-1", "web-app", Visibility.shared, Client.cursor),
    ],
    reports: [
      ...martaHistory(),
      report("Sam Ortiz", {
        session_id: "sam-webhooks-1", ticket_ref: "PAY-88", task: "Fix duplicate Stripe webhook processing",
        summary: "Stripe resent webhooks that took too long, so some charges were processed twice. The handler now acknowledges immediately and a queue does the work.",
        modules: ["webhooks", "payments"], tags: ["stripe", "idempotency"],
        artifacts: [{ kind: "file", ref: "src/payments/webhooks.ts" }, { kind: "file", ref: "src/payments/queue.ts" }],
        dead_ends: [{ attempt: "Retrying webhook processing inline in the handler", reason: "Stripe times out after 10 seconds and resends the event, so inline retries processed charges twice" }],
        decisions: [{ area: DecisionArea.technical, choice: "Return 200 immediately and process webhooks from a queue with an idempotency key per Stripe event id", reason: "Stripe resends anything slower than 10 seconds; the idempotency key makes resends safe" }],
      }),
      report("Ana Lee", {
        session_id: "ana-retry-1", ticket_ref: "BILL-142", status: ReportStatus.inProgress, task: "Rewrite billing retry logic with exponential backoff",
        summary: "Backoff with jitter is in place; moving the max-attempts setting out of dunning_config into retry.ts constants, so the retry helper signature changes.",
        modules: ["billing", "retry-logic"], artifacts: [{ kind: "file", ref: "src/billing/retry.ts" }, { kind: "file", ref: "src/billing/schedule.ts" }],
        decisions: [{ area: DecisionArea.technical, choice: "Exponential backoff with jitter, capped at 6 attempts", reason: "Spreads retries out so card networks do not flag them as fraud" }],
      }),
      report("Jules Moreau", {
        client: Client.cursor, session_id: "jules-auth-1", ticket_ref: "AUTH-31", status: ReportStatus.blocked, task: "Migrate auth sessions to signed cookies",
        summary: "Login works locally but staging SSO rejects the callback with the new cookie.",
        modules: ["auth", "sessions"], artifacts: [{ kind: "file", ref: "src/auth/session.ts" }, { kind: "file", ref: "src/auth/sso.ts" }],
        blockers: ["Staging SSO callback rejects the new cookie domain"],
        dead_ends: [{ attempt: "Setting the cookie domain to the apex domain", reason: "The SSO provider only allows the exact staging host" }],
      }),
      report("Kai Brennan", {
        session_id: "kai-private-1", visibility: Visibility.private, status: ReportStatus.inProgress,
        task: `${PRIVATE_MARKER} compare salary bands for the promotion packet`,
        summary: `${PRIVATE_MARKER} notes on retry-logic ownership and billing webhook pay bands.`,
        modules: ["billing", "retry-logic", "webhooks"], artifacts: [{ kind: "doc", ref: `${PRIVATE_MARKER} promotion packet` }],
        dead_ends: [{ attempt: `${PRIVATE_MARKER} inline webhook retry processing`, reason: `${PRIVATE_MARKER} Stripe resends the event after 10 seconds` }],
      }),
      report("Theo Lindqvist", {
        workspace: BANK_WS, session_id: "theo-halvorsen-1", ticket_ref: "HALV-2", task: "Valuation section for the Halvorsen pitch book",
        summary: "Drafted the valuation pages with a trading comps range and a precedent transactions cross-check.",
        modules: ["halvorsen", "valuation"], tags: ["pitch-book"],
        artifacts: [{ kind: "client", ref: "Halvorsen Industrial" }, { kind: "doc", ref: "Halvorsen pitch book v3" }],
        decisions: [{ area: DecisionArea.product, choice: "Use EV/EBITDA rather than P/E for the peer set", reason: "Two peers have negative earnings, so P/E is not meaningful" }],
        dead_ends: [{ attempt: "Precedent transactions from 2019", reason: "Pre-rate-hike multiples overstated value by about two turns" }],
      }),
      report("Mara Okafor", {
        workspace: BANK_WS, session_id: "mara-falcon-1", ticket_ref: "FALCON-7", status: ReportStatus.blocked, task: "Refresh trading comps for Project Falcon",
        summary: "Updated the Falcon LBO model with Q3 comps; two peers are missing from the vendor feed.",
        modules: ["falcon", "comps"],
        artifacts: [{ kind: "deal", ref: "Project Falcon" }, { kind: "model", ref: "Falcon LBO v7" }, { kind: "client", ref: "Halvorsen Industrial" }],
        blockers: ["Q3 comps data from the data vendor is missing two peers"],
      }),
    ],
  };
}

export const demoSteps = {
  devBCollision: (): ReportProgressInput =>
    report("Bo Chen", {
      session_id: "bo-webhooks-live", ticket_ref: "BILL-150", status: ReportStatus.inProgress, task: "Build the Stripe webhook handler for invoice payments",
      summary: "Started the Stripe webhook handler; failed payments are handed to the billing retry helper in retry.ts.",
      modules: ["webhooks", "billing", "retry-logic"], artifacts: [{ kind: "file", ref: "src/billing/webhooks.ts" }, { kind: "file", ref: "src/billing/retry.ts" }],
    }),
  devBRediscovery: (): ReportProgressInput =>
    report("Bo Chen", {
      session_id: "bo-webhooks-live", ticket_ref: "BILL-150", status: ReportStatus.blocked, task: "Build the Stripe webhook handler for invoice payments",
      summary: "Some invoice payments are applied twice because Stripe resends the webhook while the handler is still retrying.",
      modules: ["webhooks", "billing"],
      blockers: ["Stripe resends the webhook after a 10 second timeout and the handler processes the charge twice"],
      dead_ends: [{ attempt: "Retrying webhook processing inline in the handler", reason: "Stripe resent the event after 10 seconds and charges were processed twice" }],
    }),
  unrelated: (): ReportProgressInput =>
    report("Noor Haddad", {
      session_id: "noor-copy-live", task: "Refresh onboarding screen copy in the mobile app",
      summary: "Rewrote the welcome carousel headlines and fixed two typos in the signup screen.",
      modules: ["mobile-onboarding"], artifacts: [{ kind: "file", ref: "app/screens/Welcome.tsx" }],
    }),
};
