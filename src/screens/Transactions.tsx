import { transactions } from "../data";
import { TransactionTable } from "./TransactionTable";

export function Transactions() {
  return (
    <>
      <h1>Transactions</h1>
      <p className="lede">
        Posted, pending, and disputed activity on the Northwind Studio account. Sample data only.
      </p>
      <section className="card">
        <TransactionTable rows={transactions} caption="Account transactions" />
      </section>
    </>
  );
}
