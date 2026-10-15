import { Card } from "../components/Card";
import { EmptyState } from "../components/EmptyState";
import { Link } from "../components/Link";
import { account, disputes, formatMoney, transactions } from "../data";
import { TransactionTable } from "./TransactionTable";

export function AccountOverview() {
  const pending = transactions.filter((row) => row.status === "pending").length;
  const recent = transactions.slice(0, 3);

  return (
    <>
      <section className="account-hero">
        <p className="eyebrow">
          {account.kind} ···{account.mask} · {account.plan} plan
        </p>
        <h1>{account.name}</h1>
        <p className="balance">{formatMoney(account.available)}</p>
        <p className="balance-label">Available</p>
      </section>

      <div className="stat-row">
        <section className="card">
          <p className="stat-value">{transactions.length}</p>
          <p className="stat-label">Transactions in view</p>
        </section>
        <section className="card">
          <p className="stat-value">{pending}</p>
          <p className="stat-label">Pending</p>
        </section>
        <section className="card">
          <p className="stat-value">{disputes.length}</p>
          <p className="stat-label">Open disputes</p>
        </section>
      </div>

      <div className="stack">
        <Card title="Recent transactions">
          <TransactionTable rows={recent} caption="Three most recent transactions" />
          <p>
            <Link to="/transactions">View all transactions</Link>
          </p>
        </Card>
        <Card title="Linked cards">
          <EmptyState
            title="No cards linked"
            body="This demo account has no debit or credit cards yet. The rows above are transfers and plan charges."
          />
        </Card>
      </div>
    </>
  );
}
