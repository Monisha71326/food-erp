import ListPage from "@/components/ListPage/ListPage.jsx";
import TableLink from "@/components/TableLink/TableLink.jsx";
import { textColumn, statusColumn } from "@/components/DataTable/columnHelpers.jsx";
import "./DeliveryChallansPage.css";

const columns = [
  { key: "number", label: "Delivery Challan#", sortable: true, render: (row) => <TableLink>{row.number}</TableLink> },
  textColumn("ref", "Reference Number"),
  textColumn("customer", "Customer Name"),
  statusColumn(),
  statusColumn("invoiceStatus", "Invoice Status"),
  { key: "amount", label: "Amount", align: "right", sortable: true, render: (row) => row.amount },
];

export default function DeliveryChallansPage() {
  return (
    <ListPage
      className="delivery-challans-page"
      eyebrow="SALES" title="All Delivery Challans" icon="fa-truck-ramp-box"
      entity="delivery challans" searchPlaceholder="Search in Delivery Challans"
      columns={columns}
    />
  );
}
