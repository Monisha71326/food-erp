import ListPage from "@/components/ListPage/ListPage.jsx";
import TableLink from "@/components/TableLink/TableLink.jsx";
import { dateColumn, textColumn, amountColumn, statusColumn } from "@/components/DataTable/columnHelpers.jsx";
import "./RecurringInvoicesPage.css";

const columns = [
  textColumn("customer", "Customer Name"),
  { key: "profile", label: "Profile Name", sortable: true, render: (row) => <TableLink>{row.profile}</TableLink> },
  textColumn("frequency", "Frequency"),
  dateColumn("last", "Last Invoice Date"),
  dateColumn("next", "Next Invoice Date"),
  statusColumn(),
  amountColumn("amount", "Amount", 2),
];

export default function RecurringInvoicesPage() {
  return (
    <ListPage
      className="recurring-invoices-page"
      eyebrow="SALES" title="All Recurring Invoices" icon="fa-arrows-rotate"
      entity="recurring invoices" searchPlaceholder="Search in Recurring Invoices"
      columns={columns}
    />
  );
}
