import StatusPill from "@/components/StatusPill/StatusPill.jsx";
import { fmtDate, money } from "@/utils/format.js";

/*
 * Small helpers that build column definitions for <DataTable />.
 * A column looks like: { key, label, sortable, align, sortValue, render }
 */

/* "--" shown for empty cells */
export const Dash = () => <span className="muted">--</span>;

/* small gray icon inside a cell (paperclip, eye, ...) */
export const CellIcon = ({ name }) => <i className={`fa-solid ${name} cell-ic`} aria-hidden="true" />;

/* "2026-02-13" -> "13 Feb 2026" (sorts by the ISO value) */
export const dateColumn = (key, label) => ({
  key, label, sortable: true,
  sortValue: (row) => row[key] || "",
  render: (row) => fmtDate(row[key]),
});

/* plain text, "--" when empty */
export const textColumn = (key, label, extra = {}) => ({
  key, label, sortable: true,
  render: (row) => row[key] || <Dash />,
  ...extra,
});

/* right-aligned money value */
export const amountColumn = (key, label, decimals = 0) => ({
  key, label, align: "right", sortable: true,
  render: (row) => money(row[key], decimals),
});

/* colored status pill */
export const statusColumn = (key = "status", label = "Status", icon) => ({
  key, label, sortable: true,
  render: (row) => <StatusPill status={row[key]} icon={icon} />,
});
