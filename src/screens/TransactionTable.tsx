import { Badge, type BadgeTone } from "../components/Badge";
import { Link } from "../components/Link";
import { Table, type Column } from "../components/Table";
import { formatDate, formatMoney, type Transaction, type TxStatus } from "../data";

const toneForStatus: Record<TxStatus, BadgeTone> = {
  posted: "good",
  pending: "warning",
  disputed: "danger",
};

const labelForStatus: Record<TxStatus, string> = {
  posted: "Posted",
  pending: "Pending",
  disputed: "Disputed",
};

const columns: Column<Transaction>[] = [
  {
    key: "date",
    header: "Date",
    render: (row) => formatDate(row.date),
  },
  {
    key: "description",
    header: "Description",
    render: (row) =>
      row.disputeId ? (
        <Link to={`/disputes/${row.disputeId}`}>{row.description}</Link>
      ) : (
        row.description
      ),
  },
  {
    key: "status",
    header: "Status",
    render: (row) => <Badge tone={toneForStatus[row.status]}>{labelForStatus[row.status]}</Badge>,
  },
  {
    key: "amount",
    header: "Amount",
    numeric: true,
    render: (row) => formatMoney(row.amount),
  },
];

type TransactionTableProps = {
  rows: Transaction[];
  caption: string;
};

export function TransactionTable({ rows, caption }: TransactionTableProps) {
  return <Table caption={caption} columns={columns} rows={rows} getRowKey={(row) => row.id} />;
}
