/*
 * Role-based menus, same as the Zulekha Order Hub: each login role sees only its own menus.
 *   client  -> Client Portal       manager -> Area Manager       admin -> Admin / Back office
 *   erp     -> full MEG ERP (all 12 ERP modules + Order Hub)
 * Each role: { label, desc, icon, home (first page after login), subtitle, sections: [{ title?, items }] }
 * Page labels must match keys in pages/pageRegistry.js.
 */
import { navPrimary, navOrderHub, navOrderHubAll, navSecondary } from "./navigationData.js";

/* Look up from navOrderHubAll so moved groups (Sales & Invoice, Marketing) are still found. */
const hub = (label) => navOrderHubAll.find((g) => g.label === label);
const erpGroup = (label) => navPrimary.find((g) => g.label === label);

const client = hub("Client Portal");
const manager = hub("Area Manager");

/* "Sales & Invoice" group (Orders, Invoices, POD Matching ...) is defined once in navigationData.js */
const salesInvoice = hub("Sales & Invoice");

/* "Contact Support" lives in the System & Admin group; Client and Area Manager get it as a direct menu item. */
const contactSupport = hub("System & Admin").children.find((c) => c.label === "Contact Support");

/* Admin / Back office: Order Hub back-office groups.
   "Finance & Credit" and "Supply Chain" are HIDDEN (see HIDDEN_HUB in navigationData.js). */
const adminHubGroups = [
  salesInvoice,
  hub("Marketing"), // Products & Services, Promotions, Sales Reporting (was "Sales & Marketing")
  // hub("Finance & Credit"), // HIDDEN
  // hub("Supply Chain"),     // HIDDEN
  hub("System & Admin"),
].filter(Boolean);

/* Back office can customise the invoice template: a "Settings & Administration" group with only that page. */
const invoiceTemplateGroup = (() => {
  const g = erpGroup("Settings & Administration");
  const item = g?.children.find((c) => c.label === "Invoice Templates");
  return g && item ? { ...g, children: [item] } : null;
})();

/* ... plus the ERP modules a back-office user works in every day. */
const adminErpGroups = [
  ...["Customers", "Vendors & Purchases", "Items & Inventory", "Reports"].map(erpGroup).filter(Boolean),
  ...(invoiceTemplateGroup ? [invoiceTemplateGroup] : []),
];

export const ROLES = {
  client: {
    label: "Client",
    desc: "Place orders, view invoices & offers",
    icon: "fa-store",
    home: "Client Dashboard",
    subtitle: "Client account",
    sections: [{ items: [...client.children, contactSupport] }],
  },
  manager: {
    label: "Area Manager",
    desc: "Visits, client orders, place on behalf",
    icon: "fa-user-tie",
    home: "Manager Dashboard",
    subtitle: "Area manager",
    sections: [{ items: [...manager.children, contactSupport] }],
  },
  admin: {
    label: "Admin / Back office",
    desc: "Sales & invoices, pricing, inventory, finance",
    icon: "fa-screwdriver-wrench",
    home: "Orders", // was "Admin Demo Script"
    subtitle: "Back office",
    sections: [
      { items: adminHubGroups },
      { title: "MEG ERP", items: adminErpGroups },
    ],
  },
  erp: {
    label: "ERP Administrator",
    desc: "Full MEG ERP — every module",
    icon: "fa-gauge-high",
    home: "Dashboard",
    subtitle: "Administrator",
    sections: [
      // Dashboard ... Documents, Sales & Invoice, Marketing, Settings & Administration
      { items: navPrimary },
      // Client Portal, Area Manager, System & Admin (Finance & Credit / Supply Chain are hidden)
      { title: "Order Hub", items: navOrderHub },
      // navSecondary is empty now (the 12 ERP modules cover it); only add the section if it ever has items again.
      ...(navSecondary.length ? [{ items: navSecondary }] : []),
    ],
  },
};