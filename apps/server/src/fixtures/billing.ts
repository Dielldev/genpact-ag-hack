import { Client, DecisionArea, ReportStatus, Visibility, type ReportProgressInput } from "@mesh/contract";

export const DEV_WS = "acme-dev";
export const BANK_WS = "northbank-deals";

type Fields = Partial<ReportProgressInput> & Pick<ReportProgressInput, "task" | "summary">;

export function report(person: string, fields: Fields): ReportProgressInput {
  return {
    client: Client.claudeCode,
    workspace: DEV_WS,
    visibility: Visibility.shared,
    status: ReportStatus.done,
    artifacts: [],
    modules: [],
    tags: [],
    dead_ends: [],
    human_corrections: [],
    blockers: [],
    session_id: "",
    person,
    ...fields,
  };
}

const file = (ref: string) => ({ kind: "file", ref });

export function martaHistory(): ReportProgressInput[] {
  const m = (n: number, fields: Fields) => report("Marta Silva", { ...fields, session_id: `marta-billing-${n}` });
  return [
    m(1, { task: "Set up the billing retry worker", ticket_ref: "BILL-101", summary: "Added a worker that retries failed card charges automatically.", modules: ["billing", "retry-logic"], artifacts: [file("src/billing/retry.ts"), file("src/billing/worker.ts")] }),
    m(2, { task: "Retry schedule for failed charges", ticket_ref: "BILL-101", summary: "Moved failed-charge retries to an increasing schedule after the fixed cron caused merchant blocks.", modules: ["billing", "retry-logic"], artifacts: [file("src/billing/retry.ts")], dead_ends: [{ attempt: "Retrying failed charges on a fixed 5-minute cron", reason: "Card networks flagged the repeated attempts as fraud and blocked our merchant ID for 24 hours" }] }),
    m(3, { task: "Invoice PDF rendering", ticket_ref: "BILL-104", summary: "Invoices render to PDF on finalize and are attached to the receipt email.", modules: ["billing", "invoicing"], artifacts: [file("src/billing/invoice.ts"), file("src/billing/pdf.ts")] }),
    m(4, { task: "Ledger writes for finalized invoices", ticket_ref: "BILL-104", summary: "Finalized invoices now write a ledger entry through the ledger client.", modules: ["billing", "ledger"], artifacts: [file("src/ledger/client.ts"), file("src/billing/invoice.ts")], human_corrections: [{ correction: "Write through the existing ledger client instead of raw SQL", reason: "Finance audits every ledger write through the client audit log" }] }),
    m(5, { task: "Proration for mid-cycle plan changes", ticket_ref: "BILL-109", summary: "Upgrades and downgrades mid-cycle now prorate on the next invoice.", modules: ["billing", "proration"], artifacts: [file("src/billing/proration.ts")] }),
    m(6, { task: "Fix proration rounding", ticket_ref: "BILL-109", summary: "Proration is computed server-side in integer cents; invoice totals match the ledger again.", modules: ["billing", "proration"], artifacts: [file("src/billing/proration.ts")], dead_ends: [{ attempt: "Computing proration in the web client", reason: "Float rounding differed from the ledger service and invoices were off by one cent" }] }),
    m(7, { task: "Dunning emails for failed payments", ticket_ref: "BILL-112", summary: "Customers get dunning emails after failed retries, linked to the payment update page.", modules: ["billing", "dunning"], artifacts: [file("src/billing/dunning.ts")], human_corrections: [{ correction: "Cap dunning at 3 emails instead of 5", reason: "Support saw a churn spike when customers received 5 emails" }] }),
    m(8, { task: "Retry limits from dunning config", ticket_ref: "BILL-112", summary: "The retry worker reads max_attempts from the dunning_config table.", modules: ["billing", "retry-logic", "dunning"], artifacts: [file("src/billing/retry.ts"), file("src/billing/dunning.ts")], decisions: [{ area: DecisionArea.technical, choice: "Read max_attempts for billing retries from the dunning_config table", reason: "Finance changes it without a deploy, and the dunning emails and webhook handler depend on the same value, so changing retry.ts alone silently breaks dunning" }] }),
    m(9, { task: "Billing export for finance", ticket_ref: "BILL-115", summary: "Nightly CSV export of invoices and payments for finance.", modules: ["billing", "ledger"], artifacts: [file("src/billing/export.ts")] }),
    m(10, { task: "Payment capture concurrency", ticket_ref: "BILL-115", summary: "Payment capture uses optimistic version checks on the invoice row.", modules: ["billing", "invoicing"], artifacts: [file("src/billing/capture.ts"), file("src/billing/invoice.ts")], dead_ends: [{ attempt: "Locking the invoice row during payment capture", reason: "It deadlocked with the nightly ledger export; optimistic version checks avoid the lock" }] }),
    m(11, { task: "Tax lines on invoices", ticket_ref: "BILL-118", summary: "Invoices show tax per line item from the tax service.", modules: ["billing", "invoicing"], artifacts: [file("src/billing/invoice.ts")] }),
    m(12, { task: "Retry worker metrics", ticket_ref: "BILL-120", summary: "Retry worker emits attempt and success counters for the ops dashboard.", modules: ["billing", "retry-logic"], artifacts: [file("src/billing/retry.ts"), file("src/billing/metrics.ts")] }),
    m(13, { task: "Credit notes", ticket_ref: "BILL-122", summary: "Support can issue credit notes that reverse ledger entries.", modules: ["billing", "ledger"], artifacts: [file("src/billing/credit-notes.ts"), file("src/ledger/client.ts")] }),
    m(14, { task: "Invoice numbering per entity", ticket_ref: "BILL-125", summary: "Invoice numbers are sequential per legal entity.", modules: ["billing", "invoicing"], artifacts: [file("src/billing/invoice.ts")] }),
    m(15, { task: "Retry worker cleanup", ticket_ref: "BILL-130", summary: "Removed dead code paths from the retry worker and documented the schedule.", modules: ["billing", "retry-logic"], artifacts: [file("src/billing/retry.ts"), { kind: "doc", ref: "docs/billing/retries.md" }] }),
  ];
}
