export type TxStatus = "posted" | "pending" | "disputed";

export type Transaction = {
  id: string;
  date: string;
  description: string;
  amount: number;
  status: TxStatus;
  disputeId?: string;
};

export type TimelineEvent = {
  date: string;
  text: string;
};

export type Dispute = {
  id: string;
  transactionId: string;
  statusLabel: string;
  amount: number;
  opened: string;
  merchant: string;
  reason: string;
  timeline: TimelineEvent[];
};

export const account = {
  name: "Northwind Studio",
  plan: "Scale",
  mask: "4418",
  kind: "Business checking",
  available: 12840.22,
};

export const transactions: Transaction[] = [
  {
    id: "txn_8841",
    date: "2026-08-21",
    description: "Harbour Office Supply",
    amount: -86.4,
    status: "disputed",
    disputeId: "dsp_1043",
  },
  {
    id: "txn_8832",
    date: "2026-08-20",
    description: "Scale plan renewal",
    amount: -249,
    status: "posted",
  },
  {
    id: "txn_8810",
    date: "2026-08-18",
    description: "Northline Payroll",
    amount: -4200,
    status: "posted",
  },
  {
    id: "txn_8794",
    date: "2026-08-17",
    description: "Client payment — Brightwell Labs",
    amount: 6400,
    status: "pending",
  },
  {
    id: "txn_8770",
    date: "2026-08-14",
    description: "City Transit pass",
    amount: -42,
    status: "posted",
  },
  {
    id: "txn_8744",
    date: "2026-08-11",
    description: "Paper and Ink Co.",
    amount: -128.16,
    status: "posted",
  },
];

export const disputes: Dispute[] = [
  {
    id: "dsp_1043",
    transactionId: "txn_8841",
    statusLabel: "In review",
    amount: 86.4,
    opened: "2026-08-20",
    merchant: "Harbour Office Supply",
    reason:
      "Charged twice for the same office-supply order. A payment to Paper and Ink Co. already posted on 11 August.",
    timeline: [
      { date: "2026-08-20", text: "You opened the dispute from the posted charge." },
      { date: "2026-08-21", text: "We asked the merchant for a copy of the receipt." },
      { date: "2026-08-23", text: "Still waiting on the merchant." },
    ],
  },
];

export function formatMoney(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${iso}T00:00:00Z`));
}

export function transactionById(id: string): Transaction | undefined {
  return transactions.find((row) => row.id === id);
}

export function disputeById(id: string): Dispute | undefined {
  return disputes.find((row) => row.id === id);
}
