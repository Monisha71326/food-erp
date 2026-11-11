/* Sidebar menu structure. Each item: { label, icon (Font Awesome class), children? } */
/* The `label` of every leaf item is what links it to a page in src/pages/pageRegistry.js. */

/* ---------- Groups moved into the main ERP menu (shown right after "Documents") ---------- */
/* Renamed: "Fulfilment & Logistics" -> "Sales & Invoice" (same menu items inside) */
const groupFulfilment = {
  label: "Sales & Invoice", icon: "fa-truck-fast",
  children: [
    { label: "Orders", icon: "fa-clipboard-list" },
    { label: "Place Order for Client", icon: "fa-cart-plus" }, // NEW: admin places an order on behalf of a client (same page the Area Manager uses)
    { label: "Invoices", icon: "fa-file-invoice-dollar" }, // NEW: opens the Invoices page (share, record payment, print)
    { label: "Client Account Statement", icon: "fa-file-lines" }, // NEW: pick a client from a dropdown and see that client's statement
    { label: "Credit Aging Report", icon: "fa-hourglass-half" }, // NEW: customer-wise bad credit report (0-30, 31-60, 61-90, 91-120, 120+ days)
    { label: "POD Matching", icon: "fa-clipboard-check" },
    { label: "POD Auto-Match", icon: "fa-robot" },
    { label: "Backorders", icon: "fa-box-open" },
    { label: "Live Managers", icon: "fa-location-crosshairs" }, // admin sees where area managers are right now
    // { label: "Shipping (DPD)", icon: "fa-truck" }, // HIDDEN (remove the comment marks to show it again)
  ],
};

const groupSalesMarketing = {
  label: "Marketing", icon: "fa-bullhorn",
  children: [
    { label: "Products & Services", icon: "fa-tags" },
    { label: "Promotions", icon: "fa-percent" },
    { label: "Sales Reporting", icon: "fa-chart-column" },
  ],
};

/* ---------- Main ERP navigation (client specification: UK edition) ---------- */
export const navPrimary = [
  /* 1. Dashboard — Business Overview, Cash Flow, Total Receivables, Total Payables,
        Income & Expenses and Bank Balances are widgets shown ON the dashboard page itself. */
  { label: "Dashboard", icon: "fa-gauge-high" },

  /* 2. Customers */
  {
    label: "Customers",
    icon: "fa-user-tie",
    children: [
      { label: "Customer List", icon: "fa-users" },
      { label: "Quotes", icon: "fa-file-signature" },
      // { label: "Sales Orders", icon: "fa-cart-shopping" }, // HIDDEN (remove the comment marks to show it again)
      // { label: "Invoices", icon: "fa-file-invoice-dollar" }, // HIDDEN (still available under "Sales & Invoice")
      // { label: "Retainer Invoices", icon: "fa-hand-holding-dollar" }, // HIDDEN (remove the comment marks to show it again)
      // { label: "Recurring Invoices", icon: "fa-rotate" }, // HIDDEN (remove the comment marks to show it again)
      // { label: "Credit Notes", icon: "fa-rotate-left" }, // HIDDEN (remove the comment marks to show it again)
      // { label: "Customer Payments", icon: "fa-hand-holding-dollar" }, // HIDDEN (remove the comment marks to show it again)
      // { label: "Customer Statements", icon: "fa-file-lines" }, // HIDDEN (remove the comment marks to show it again)
      // { label: "Aged Receivables", icon: "fa-hourglass-half" }, // HIDDEN (remove the comment marks to show it again)
    ],
  },

  /* NEW: Credit Note, Debit Note, Payments, Receipts */
  {
    label: "Credit & Payments",
    icon: "fa-money-check-dollar",
    children: [
      { label: "Credit Note", icon: "fa-file-circle-minus" },
      { label: "Debit Note", icon: "fa-file-circle-plus" },
      { label: "Payments", icon: "fa-money-bill-transfer" },
      { label: "Payment Receipts", icon: "fa-receipt" },
    ],
  },

  /* 3. Vendors & Purchases: HIDDEN (remove the comment marks to show it again)
  {
    label: "Vendors & Purchases",
    icon: "fa-basket-shopping",
    children: [
      { label: "Vendors", icon: "fa-truck-field" },
      { label: "Purchase Orders", icon: "fa-file-lines" },
      { label: "Bills", icon: "fa-file-invoice" },
      { label: "Recurring Bills", icon: "fa-rotate" },
      { label: "Expenses", icon: "fa-wallet" },
      { label: "Vendor Credits", icon: "fa-receipt" },
      // { label: "Payments Made", icon: "fa-money-bill-transfer" }, // HIDDEN (remove the comment marks to show it again)
      // { label: "Aged Payables", icon: "fa-hourglass-half" }, // HIDDEN (remove the comment marks to show it again)
    ],
  },
  */

  /* 4. Items & Inventory: HIDDEN (remove the comment marks to show it again)
     (advanced inventory options depend on the subscription plan)
  {
    label: "Items & Inventory",
    icon: "fa-boxes-stacked",
    children: [
      { label: "Items", icon: "fa-box" },
      { label: "Services", icon: "fa-screwdriver-wrench" },
      { label: "Item Groups", icon: "fa-layer-group" },
      { label: "Price Lists", icon: "fa-tags" },
      { label: "Stock Adjustments", icon: "fa-sliders" },
      { label: "Warehouses / Locations", icon: "fa-warehouse" },
      { label: "Reorder Points", icon: "fa-bell" },
      { label: "Packages", icon: "fa-box-open" },
      { label: "Shipments", icon: "fa-truck-fast" },
      { label: "Stock Valuation", icon: "fa-scale-balanced" },
    ],
  },
  */

  /* 5. Banking: HIDDEN (remove the comment marks to show it again)
  {
    label: "Banking",
    icon: "fa-landmark",
    children: [
      { label: "Bank Accounts", icon: "fa-building-columns" },
      { label: "Credit Cards", icon: "fa-credit-card" },
      { label: "Bank Feeds", icon: "fa-rss" },
      { label: "Bank Transactions", icon: "fa-arrow-right-arrow-left" },
      { label: "Bank Rules", icon: "fa-list-check" },
      { label: "Bank Reconciliation", icon: "fa-scale-balanced" },
      { label: "Transfers", icon: "fa-right-left" },
      { label: "Petty Cash", icon: "fa-coins" },
    ],
  },
  */

  /* 6. VAT & Tax: HIDDEN (remove the comment marks to show it again)
  {
    label: "VAT & Tax",
    icon: "fa-percent",
    children: [
      { label: "VAT Settings", icon: "fa-gear" },
      { label: "VAT Rates", icon: "fa-percent" },
      { label: "VAT Returns", icon: "fa-file-signature" },
      { label: "VAT Payments & Reclaims", icon: "fa-money-bill-transfer" },
      { label: "VAT Adjustments", icon: "fa-sliders" },
      { label: "HMRC Filing", icon: "fa-paper-plane" },
      { label: "Making Tax Digital (MTD)", icon: "fa-laptop-code" },
      { label: "VAT Reports", icon: "fa-chart-column" },
    ],
  },
  */

  /* 7. CIS — Construction Industry Scheme: HIDDEN (remove the comment marks to show it again)
  {
    label: "CIS — Construction Industry Scheme",
    icon: "fa-helmet-safety",
    children: [
      { label: "Contractors", icon: "fa-person-digging" },
      { label: "Subcontractors", icon: "fa-people-group" },
      { label: "CIS Deductions", icon: "fa-file-invoice" },
      { label: "CIS Payments", icon: "fa-money-bill-wave" },
      { label: "CIS Returns", icon: "fa-file-circle-check" },
      { label: "Deduction Statements", icon: "fa-file-lines" },
    ],
  },
  */

  /* 8. Accountant */
  {
    label: "Accountant",
    icon: "fa-calculator",
    children: [
      { label: "Chart of Accounts", icon: "fa-sitemap" },
      { label: "Manual Journals", icon: "fa-book-open" },
      { label: "Recurring Journals", icon: "fa-rotate" },
      { label: "Opening Balances", icon: "fa-flag-checkered" },
      { label: "Sub-Accounts", icon: "fa-diagram-project" },
      { label: "Transaction Locking", icon: "fa-lock" },
      { label: "Base Currency Adjustments", icon: "fa-sterling-sign" },
    ],
  },

  /* 9. Projects & Timesheets: HIDDEN (remove the comment marks to show it again)
     Note: if you show it again, remove "Retainer Invoices" from it or from Customers (labels must be unique).
  {
    label: "Projects & Timesheets",
    icon: "fa-briefcase",
    children: [
      { label: "Projects", icon: "fa-folder-open" },
      { label: "Tasks", icon: "fa-list-check" },
      { label: "Timesheets", icon: "fa-clock" },
      { label: "Project Expenses", icon: "fa-wallet" },
      { label: "Project Budgets", icon: "fa-piggy-bank" },
      { label: "Retainer Invoices", icon: "fa-hand-holding-dollar" },
      { label: "Project Profitability", icon: "fa-chart-line" },
    ],
  },
  */

  /* 10. Reports */
  {
    label: "Reports",
    icon: "fa-chart-pie",
    children: [
      { label: "Profit & Loss", icon: "fa-chart-line" },
      { label: "Balance Sheet", icon: "fa-scale-balanced" },
      { label: "Cash Flow Statement", icon: "fa-money-bill-trend-up" },
      { label: "Trial Balance", icon: "fa-table-list" },
      { label: "General Ledger", icon: "fa-book" },
      { label: "Aged Receivables", icon: "fa-hourglass-half" },
      { label: "Aged Payables", icon: "fa-hourglass-half" },
      { label: "VAT Returns", icon: "fa-file-signature" },
      { label: "Sales Reports", icon: "fa-chart-column" },
      { label: "Purchase Reports", icon: "fa-chart-column" },
      { label: "Inventory Reports", icon: "fa-boxes-stacked" },
    ],
  },

  /* 11. Documents */
  {
    label: "Documents",
    icon: "fa-folder-tree",
    children: [
      { label: "Receipts", icon: "fa-receipt" },
      { label: "Supplier Documents", icon: "fa-file-contract" },
      { label: "Attachments", icon: "fa-paperclip" },
      { label: "Document Storage", icon: "fa-hard-drive" },
      { label: "Transaction Documents", icon: "fa-file-invoice" },
    ],
  },

  /* MOVED: placed right after Documents */
  groupFulfilment,
  groupSalesMarketing,

  /* 12. Settings & Administration */
  {
    label: "Settings & Administration",
    icon: "fa-gear",
    children: [
      { label: "Organisation Profile", icon: "fa-building" },
      { label: "Users & Roles", icon: "fa-users-gear" },
      { label: "Permissions", icon: "fa-user-shield" },
      { label: "Currencies", icon: "fa-coins" },
      { label: "Financial Year", icon: "fa-calendar-days" },
      { label: "Document Templates", icon: "fa-file-pen" },
      { label: "Invoice Templates", icon: "fa-file-invoice" },
      { label: "Approval Workflows", icon: "fa-circle-check" },
      { label: "Automation", icon: "fa-robot" },
      { label: "Integrations", icon: "fa-plug" },
      { label: "Audit Trail", icon: "fa-clock-rotate-left" },
      { label: "Data Backup", icon: "fa-cloud-arrow-up" },
    ],
  },
];

/* ---------- Order Hub (ported from the Zulekha Order Hub prototype) ---------- */
/* navOrderHubAll keeps EVERY group so roles can look them up by label.
   Use navOrderHub (below) for the menu shown in the sidebar. */
export const navOrderHubAll = [
  {
    label: "Client Portal", icon: "fa-store",
    children: [
      { label: "Client Dashboard", icon: "fa-gauge-high" },
      { label: "Place Order", icon: "fa-cart-plus" },
      { label: "My Invoices", icon: "fa-file-invoice" },
      { label: "Account Statement", icon: "fa-file-lines" },
      { label: "My Offers", icon: "fa-gift" },
      { label: "My Details", icon: "fa-id-card" },
    ],
  },
  {
    label: "Area Manager", icon: "fa-user-tie",
    children: [
      { label: "Manager Dashboard", icon: "fa-gauge-high" },
     // { label: "Register a Visit", icon: "fa-location-dot" },
      { label: "Client Orders", icon: "fa-clipboard-list" },
      { label: "Client Invoices", icon: "fa-file-invoice" }, // area manager can view invoices + record payment
      { label: "Client Account Statement", icon: "fa-file-lines" }, // NEW: manager picks a client from a dropdown and sees that client's statement
      /* Own label (the page is mapped to "Credit Aging Report" too in pageRegistry.js),
         so it does not clash with the Sales & Invoice menu item of the same name. */
      { label: "Client Credit Aging", icon: "fa-hourglass-half" },
      { label: "Manager Reports", icon: "fa-chart-column" }, // area manager reports (collections, outstanding); the administrator sets targets here
      { label: "Place Order for Client", icon: "fa-cart-plus" },
    ],
  },
  groupFulfilment,      // now shown in the main ERP menu after Documents (as "Sales & Invoice")
  groupSalesMarketing,  // now shown in the main ERP menu after Documents
  {
    label: "Finance & Credit", icon: "fa-sterling-sign", // HIDDEN (listed in HIDDEN_HUB below)
    children: [
      { label: "Accounting / Invoices", icon: "fa-file-invoice-dollar" },
      { label: "Credit Control", icon: "fa-scale-balanced" },
    ],
  },
  {
    label: "Supply Chain", icon: "fa-boxes-stacked", // HIDDEN (listed in HIDDEN_HUB below)
    children: [
      { label: "Stock & Expiry", icon: "fa-cubes" },
      { label: "Demand Forecasting (AI)", icon: "fa-chart-line" },
    ],
  },
  {
    label: "System & Admin", icon: "fa-shield-halved",
    children: [
      { label: "Audit Log", icon: "fa-clock-rotate-left" },
      { label: "AI Automation Ideas", icon: "fa-lightbulb" },
      { label: "Contact Support", icon: "fa-headset" },
    ],
  },
];

/* Hub groups hidden everywhere. Remove a label from this list to show it again. */
export const HIDDEN_HUB = ["Finance & Credit", "Supply Chain"];

/* Hub groups that now live in navPrimary (so they don't appear twice in the "Order Hub" section).
   The marketing group's label is "Marketing" (it used to be "Sales & Marketing"); both are listed so it never shows twice. */
const MOVED_TO_PRIMARY = ["Sales & Invoice", "Marketing", "Sales & Marketing"];

/* Order Hub section shown in the sidebar for the ERP Administrator.
   (Area Manager group now shows "Client Credit Aging" here as well.) */
export const navOrderHub = navOrderHubAll.filter(
  (g) => !HIDDEN_HUB.includes(g.label) && !MOVED_TO_PRIMARY.includes(g.label)
);

/* The client's 12-module structure already covers Products, Customers, Suppliers, Warehouse, HR and Settings,
   so the old secondary group is empty. It is still exported so existing imports keep working. */
export const navSecondary = [];