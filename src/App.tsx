import { Link } from "./components/Link";
import { usePath } from "./router";
import { AccountOverview } from "./screens/AccountOverview";
import { DisputeDetail } from "./screens/DisputeDetail";
import { Transactions } from "./screens/Transactions";

function screenFor(path: string) {
  if (path === "/" || path === "/account") {
    return <AccountOverview />;
  }
  if (path === "/transactions") {
    return <Transactions />;
  }
  if (path.startsWith("/disputes/")) {
    return <DisputeDetail id={decodeURIComponent(path.slice("/disputes/".length))} />;
  }
  return <AccountOverview />;
}

export function App() {
  const path = usePath();
  const onAccount = path === "/" || path === "/account";
  const onTransactions = path === "/transactions";
  const onDispute = path.startsWith("/disputes/");

  return (
    <div className="shell">
      <header className="topbar">
        <Link to="/" className="brand">
          Ledger<span>ly</span>
        </Link>
        <nav className="nav" aria-label="Primary">
          <Link to="/" current={onAccount}>
            Account
          </Link>
          <Link to="/transactions" current={onTransactions}>
            Transactions
          </Link>
          <Link to="/disputes/dsp_1043" current={onDispute}>
            Dispute
          </Link>
        </nav>
      </header>
      <main>{screenFor(path)}</main>
    </div>
  );
}
