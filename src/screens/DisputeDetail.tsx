import { useState } from "react";
import { Badge } from "../components/Badge";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { EmptyState } from "../components/EmptyState";
import { Link } from "../components/Link";
import { disputeById, formatDate, formatMoney, transactionById } from "../data";

type DisputeDetailProps = {
  id: string;
};

export function DisputeDetail({ id }: DisputeDetailProps) {
  const dispute = disputeById(id);
  const [supportNote, setSupportNote] = useState("");

  if (!dispute) {
    return (
      <EmptyState
        title="Dispute not found"
        body="This demo only includes the sample dispute. Go back to transactions and open Harbour Office Supply."
      />
    );
  }

  const transaction = transactionById(dispute.transactionId);

  return (
    <>
      <p className="eyebrow">
        <Link to="/transactions">Transactions</Link>
      </p>
      <h1>Dispute</h1>
      <p className="id-row">
        <span className="mono">{dispute.id}</span>
        <button
          type="button"
          className="icon-button"
          onClick={() => {
            void navigator.clipboard?.writeText(dispute.id);
          }}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
            <rect x="8" y="8" width="11" height="11" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M5 15V5h10" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
        </button>
      </p>
      <p>
        <Badge tone="review">{dispute.statusLabel}</Badge>
      </p>

      <div className="stack">
        <Card title="Claim">
          <dl className="definition">
            <dt>Merchant</dt>
            <dd>{dispute.merchant}</dd>
            <dt>Amount</dt>
            <dd>{formatMoney(dispute.amount)}</dd>
            <dt>Opened</dt>
            <dd>{formatDate(dispute.opened)}</dd>
            <dt>Transaction</dt>
            <dd className="mono">{transaction ? transaction.id : dispute.transactionId}</dd>
          </dl>
          <p>{dispute.reason}</p>
        </Card>

        <aside
          style={{
            backgroundColor: "#e7f0ff",
            color: "#12305c",
            border: "1px solid #1a56db",
            borderRadius: 8,
            padding: "var(--space-4)",
          }}
        >
          <p style={{ margin: 0 }}>
            While this dispute is open, the charge stays pending. You do not need to pay it again.
          </p>
        </aside>

        <Card title="What happened">
          <ol className="timeline">
            {dispute.timeline.map((event) => (
              <li key={event.date}>
                <span className="muted">{formatDate(event.date)}</span>
                <span>{event.text}</span>
              </li>
            ))}
          </ol>
        </Card>

        <Card title="Need a person?">
          <Button variant="secondary" onClick={() => setSupportNote("Support is not connected in this demo.")}>
            Contact support
          </Button>
          {supportNote ? <p className="muted">{supportNote}</p> : null}
        </Card>
      </div>
    </>
  );
}
