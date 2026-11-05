import ListPage from "@/components/ListPage/ListPage.jsx";
import TableLink from "@/components/TableLink/TableLink.jsx";
import { textColumn, amountColumn } from "@/components/DataTable/columnHelpers.jsx";
import { money } from "@/utils/format.js";
import "./CustomersPage.css";

/* "John Smith Customer" -> "JS" */
const initials = (name) => String(name || "?").split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();

/* How the customer wants their invoices to be shared */
const SHARE_VIA = ["Email", "WhatsApp", "SMS", "Post"];

/* New / Edit Customer form (defined outside the component so the reference stays stable) */
const CUSTOMER_FIELDS = [
  { key: "name", label: "Contact / Customer Name", required: true },
  { key: "company", label: "Company Name" },
  { key: "email", label: "Email", type: "email" },
  { key: "phone", label: "Work Phone" },
  { key: "address", label: "Address" },
  { key: "pincode", label: "Pincode" },
  /* invoice sharing: how + where to send the invoice */
  { key: "shareVia", label: "Share invoices via", type: "select", options: SHARE_VIA, allowEmpty: true },
  { key: "shareTo", label: "Send invoices to (email / WhatsApp / mobile no.)" },
  { key: "receivables", label: "Receivables", type: "number", min: "0" },
  { key: "credits", label: "Unused Credits", type: "number", min: "0" },
];

const columns = [
  {
    key: "name", label: "Name", sortable: true,
    render: (row) => (
      <span className="name-cell">
        <span className="mini-avatar">{initials(row.name)}</span>
        <TableLink>{row.name}</TableLink>
      </span>
    ),
  },
  textColumn("company", "Company Name"),
  textColumn("email", "Email"),
  textColumn("phone", "Work Phone"),
  textColumn("pincode", "Pincode"),
  textColumn("shareVia", "Invoice via"),
  { ...amountColumn("receivables", "Receivables"), render: (row) => <b>{money(row.receivables)}</b> },
  amountColumn("credits", "Unused Credits"),
];

export default function CustomersPage() {
  return (
    <ListPage
      className="customers-page"
      eyebrow="SALES" title="All Customers" icon="fa-users"
      entity="customers" searchPlaceholder="Search in Customers"
      columns={columns}
      formFields={CUSTOMER_FIELDS}
    />
  );
}