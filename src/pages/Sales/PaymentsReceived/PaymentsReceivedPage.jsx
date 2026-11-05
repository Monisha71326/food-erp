import ListPage from "@/components/ListPage/ListPage.jsx";
import TableLink from "@/components/TableLink/TableLink.jsx";
import { CellIcon, dateColumn, textColumn } from "@/components/DataTable/columnHelpers.jsx";
import "./PaymentsReceivedPage.css";

const columns = [
  dateColumn("date", "Date"),
  textColumn("branch", "Branch"),
  {
    key: "number", label: "Payment #", sortable: true,
    render: (row) => <><TableLink>{row.number}</TableLink> <CellIcon name="fa-clipboard-check" /></>,
  },
  textColumn("type", "Type"),
  textColumn("ref", "Reference Number"),
  textColumn("customer", "Customer Name"),
  { key: "invoice", label: "Invoice#", sortable: true, render: (row) => (row.invoice ? <TableLink>{row.invoice}</TableLink> : "") },
];

export default function PaymentsReceivedPage() {
  return (
    <ListPage
      className="payments-received-page"
      eyebrow="SALES" title="All Received Payments" icon="fa-money-bill-wave"
      entity="payments" searchPlaceholder="Search in Payments Received"
      columns={columns}
    />
  );
}
