# Meg World Technologies – Food Manufacturing ERP Dashboard

A React (Vite) front-end for a food-manufacturing ERP. It has an Executive Dashboard and the full **Sales** module
(Customers, Quotes, Retainer Invoices, Sales Orders, Invoices, Recurring Invoices, Delivery Challans,
Payments Received, Credit Notes). All other sidebar items show a "Coming soon" page until they are built.

> **Project rule:** every page and every component lives in its **own folder** with its **own `.css` file**.
> Nothing is dumped into one big global stylesheet.

---

> **Order Hub module (added):** all menus of the Zulekha Order Hub prototype now live inside this ERP — see
> [Order Hub module](#order-hub-module).

## Table of contents

1. [Features](#features)
2. [Tech stack](#tech-stack)
3. [Getting started](#getting-started)
4. [Project structure](#project-structure)
5. [Where do I change X?](#where-do-i-change-x)
6. [How styling works](#how-styling-works)
7. [Naming conventions](#naming-conventions)
8. [How to add a new page](#how-to-add-a-new-page)
9. [How to add a sidebar menu item](#how-to-add-a-sidebar-menu-item)
10. [Data](#data)
11. [Page status](#page-status)
12. [Troubleshooting](#troubleshooting)

---

## Features

- Collapsible sidebar (hamburger button) with animated dropdown groups; slide-in drawer on mobile
- Executive Dashboard: KPI cards with sparklines, SVG sales/purchase trend chart (hover tooltip), SVG production donut,
  low-stock alerts, recent sales orders, today's activity
- Sales module list pages: search, click-to-sort columns, row selection, pagination (10 / 25 / 50 / 100 per page), refresh
- Animated summary totals on the Invoices page
- Dark mode toggle
- `Ctrl + K` (or `Cmd + K`) focuses the global search box
- Fully responsive (desktop, tablet, phone)
- Charts are plain SVG – **no chart library** is needed

## Tech stack

| Purpose | Library |
| --- | --- |
| UI | React 18 |
| Build tool / dev server | Vite 5 |
| Icons | Font Awesome (sidebar, tables) + lucide-react (dashboard, header) |
| Styling | Plain CSS, one file per page / component |
| Font | Inter (Google Fonts) |

## Getting started

**Requirements:** Node.js 18 or newer.

```bash
npm install        # install dependencies (first time only)
npm run dev        # start dev server  ->  http://localhost:5173
npm run build      # production build  ->  dist/
npm run preview    # preview the production build locally
```

## Project structure

```
meg-erp-dashboard/
├── index.html            # HTML entry (loads the Inter font + /src/main.jsx)
├── vite.config.js        # Vite config (React plugin + "@" alias)
├── jsconfig.json         # lets VS Code understand the "@" alias
├── package.json
└── src/
    ├── main.jsx          # starts React, loads global styles
    ├── App.jsx           # decides which page to show
    ├── assets/           # logo, images
    ├── config/           # app-wide constants (currency)
    ├── data/             # sample data + sidebar menu definition
    ├── utils/            # small helper functions (date / money formatting)
    ├── styles/           # GLOBAL styles only (tokens, reset, shared colors, animations)
    ├── layout/           # the app shell: MainLayout, Header, Sidebar
    ├── components/       # reusable pieces used by MANY pages
    └── pages/            # one folder per page
        ├── pageRegistry.js   # sidebar label -> page component
        ├── ComingSoon/
        ├── Dashboard/        # DashboardPage + components used only by the dashboard
        └── Sales/            # one folder per Sales page
```

Every folder that contains a component also contains that component's CSS file, side by side:

```
pages/Sales/Invoices/
├── InvoicesPage.jsx      # the page (what it shows)
└── InvoicesPage.css      # the page's own styles
```

<details>
<summary><b>Full file tree (click to expand)</b></summary>

```
src/
├── assets/
│   └── logo.svg
├── components/
│   ├── CountUp/
│   │   └── CountUp.jsx
│   ├── DataTable/
│   │   ├── columnHelpers.jsx
│   │   ├── DataTable.css
│   │   └── DataTable.jsx
│   ├── ListPage/
│   │   ├── ListPage.css
│   │   └── ListPage.jsx
│   ├── PageHeader/
│   │   ├── PageHeader.css
│   │   └── PageHeader.jsx
│   ├── StatusPill/
│   │   ├── StatusPill.css
│   │   └── StatusPill.jsx
│   ├── SummaryStrip/
│   │   ├── SummaryStrip.css
│   │   └── SummaryStrip.jsx
│   └── TableLink/
│       ├── TableLink.css
│       └── TableLink.jsx
├── config/
│   └── constants.js
├── data/
│   ├── dashboardData.js
│   ├── navigationData.js
│   └── salesData.js
├── layout/
│   ├── Header/
│   │   ├── Header.css
│   │   └── Header.jsx
│   ├── MainLayout/
│   │   ├── MainLayout.css
│   │   └── MainLayout.jsx
│   └── Sidebar/
│       ├── Sidebar.css
│       ├── Sidebar.jsx
│       ├── SidebarNav.css
│       └── SidebarNav.jsx
├── pages/
│   ├── ComingSoon/
│   │   ├── ComingSoonPage.css
│   │   └── ComingSoonPage.jsx
│   ├── Dashboard/
│   │   ├── components/
│   │   │   ├── CardHeader/
│   │   │   │   ├── CardHeader.css
│   │   │   │   └── CardHeader.jsx
│   │   │   ├── LowStockAlerts/
│   │   │   │   ├── LowStockAlerts.css
│   │   │   │   └── LowStockAlerts.jsx
│   │   │   ├── MiniTable/
│   │   │   │   ├── MiniTable.css
│   │   │   │   └── MiniTable.jsx
│   │   │   ├── ProductionOverview/
│   │   │   │   ├── ProductionOverview.css
│   │   │   │   └── ProductionOverview.jsx
│   │   │   ├── RecentSalesOrders/
│   │   │   │   ├── RecentSalesOrders.css
│   │   │   │   └── RecentSalesOrders.jsx
│   │   │   ├── SalesTrendChart/
│   │   │   │   ├── SalesTrendChart.css
│   │   │   │   └── SalesTrendChart.jsx
│   │   │   ├── StatCard/
│   │   │   │   ├── Sparkline.jsx
│   │   │   │   ├── StatCard.css
│   │   │   │   └── StatCard.jsx
│   │   │   └── TodayActivity/
│   │   │       ├── TodayActivity.css
│   │   │       └── TodayActivity.jsx
│   │   ├── DashboardPage.css
│   │   └── DashboardPage.jsx
│   ├── Sales/
│   │   ├── CreditNotes/
│   │   │   ├── CreditNotesPage.css
│   │   │   └── CreditNotesPage.jsx
│   │   ├── Customers/
│   │   │   ├── CustomersPage.css
│   │   │   └── CustomersPage.jsx
│   │   ├── DeliveryChallans/
│   │   │   ├── DeliveryChallansPage.css
│   │   │   └── DeliveryChallansPage.jsx
│   │   ├── Invoices/
│   │   │   ├── InvoicesPage.css
│   │   │   └── InvoicesPage.jsx
│   │   ├── PaymentsReceived/
│   │   │   ├── PaymentsReceivedPage.css
│   │   │   └── PaymentsReceivedPage.jsx
│   │   ├── Quotes/
│   │   │   ├── QuotesPage.css
│   │   │   └── QuotesPage.jsx
│   │   ├── RecurringInvoices/
│   │   │   ├── RecurringInvoicesPage.css
│   │   │   └── RecurringInvoicesPage.jsx
│   │   ├── RetainerInvoices/
│   │   │   ├── RetainerInvoicesPage.css
│   │   │   └── RetainerInvoicesPage.jsx
│   │   └── SalesOrders/
│   │       ├── SalesOrdersPage.css
│   │       └── SalesOrdersPage.jsx
│   └── pageRegistry.js
├── styles/
│   ├── animations.css
│   ├── base.css
│   ├── tones.css
│   └── variables.css
├── utils/
│   └── format.js
├── App.jsx
└── main.jsx
```

</details>

### What goes where?

| Folder | Put here | Example |
| --- | --- | --- |
| `pages/<Module>/<PageName>/` | A full screen that has a sidebar entry | `pages/Sales/Quotes/QuotesPage.jsx` |
| `pages/Dashboard/components/` | Pieces used **only** by the dashboard | `StatCard`, `SalesTrendChart` |
| `components/` | Pieces reused by **two or more** pages | `DataTable`, `StatusPill`, `PageHeader` |
| `layout/` | Things that wrap every page | `Sidebar`, `Header`, `MainLayout` |
| `styles/` | Styling shared by the whole app | colors, reset, animations |
| `data/` | Sample data (later: API calls) | `salesData.js` |

## Where do I change X?

| I want to change… | Edit this file |
| --- | --- |
| Sidebar menu items / icons | `src/data/navigationData.js` |
| Colors, sidebar width, border radius, shadow | `src/styles/variables.css` |
| Dark-mode colors | `src/styles/variables.css` (`.app.dark` block) |
| Currency symbol (£ → ₹, $ …) | `src/config/constants.js` |
| Dashboard numbers (KPIs, charts, tables) | `src/data/dashboardData.js` |
| Sales list data (customers, invoices …) | `src/data/salesData.js` |
| Columns of the Invoices table | `src/pages/Sales/Invoices/InvoicesPage.jsx` |
| Look of ALL tables | `src/components/DataTable/DataTable.css` |
| Look of status badges | `src/components/StatusPill/StatusPill.css` |
| Page title bar (icon, "New" button) | `src/components/PageHeader/` and `src/components/ListPage/` |
| Look of ONE page only | that page's own `.css` file, e.g. `InvoicesPage.css` |
| Company name / user name in the header | `src/layout/Header/Header.jsx` |
| Logo | `src/assets/logo.svg` |

## How styling works

1. **One CSS file per component / page.** Open `StatCard.jsx` → its styles are in `StatCard.css` next to it.
   The component imports its own CSS (`import "./StatCard.css";`), so a style can never be "forgotten".
2. **Global styles are tiny and live in `src/styles/`** (loaded once in `main.jsx`, in this order):

   | File | Contains |
   | --- | --- |
   | `variables.css` | design tokens: `--maroon`, `--navy`, `--bg`, `--card`, `--text`, `--border`, sidebar widths … and the dark theme |
   | `base.css` | reset, `body`, `.app`, `.muted`, and the white `.card` surface |
   | `tones.css` | `.tone-red / blue / orange / purple / green` icon-badge colors |
   | `animations.css` | `pageIn`, `pop`, `rowIn` keyframes + `.page-anim` |

3. **Use the tokens, don't hard-code colors.** Write `color: var(--maroon)` instead of `#9a0f2e`.
   Changing a token in `variables.css` updates the whole app.
4. **Each page has a scope class.** `InvoicesPage` is wrapped in `.invoices-page`, `CustomersPage` in `.customers-page`, etc.
   Page-specific CSS must start with that class so it cannot leak into other pages:

   ```css
   /* InvoicesPage.css */
   .invoices-page .dt td { padding: 16px; }   /* affects ONLY the Invoices table */
   ```
5. **Dark mode** works by the `.dark` class on the root `.app` element. In a component's CSS add overrides like
   `.app.dark .my-thing { ... }`.
6. **Responsive rules sit at the bottom of the same file** inside `@media` blocks, so each component's phone / tablet
   behaviour is easy to find. Breakpoints used: `1280px`, `1100px`, `900px`, `640px`.
7. **Plain CSS is global in the browser.** Vite bundles all CSS together, so keep class names specific
   (`.lowstock-card`, not `.card2`) and always scope page styles under the page class.

## Naming conventions

| Thing | Rule | Example |
| --- | --- | --- |
| Page component | `PascalCase` + `Page` | `InvoicesPage.jsx` |
| Page folder | `PascalCase`, same name without `Page` | `pages/Sales/Invoices/` |
| Component | `PascalCase` | `StatusPill.jsx` |
| Component CSS | exactly the same name as the component | `StatusPill.css` |
| Non-component JS (data, utils) | `camelCase` | `salesData.js`, `format.js` |
| CSS scope class of a page | `kebab-case`, page name + `-page` | `.invoices-page` |
| Import of project files | use the `@` alias | `import DataTable from "@/components/DataTable/DataTable.jsx"` |

**The `@` alias** always points to `src/`, so you never write `../../../`.
Inside one component folder or its direct neighbours a relative import (`./Sparkline.jsx`, `../CardHeader/CardHeader.jsx`) is fine.

## How to add a new page

Example: a **Vendors** list page under **Purchasing**.

**1. Create the folder and the two files**

```
src/pages/Purchasing/Vendors/
├── VendorsPage.jsx
└── VendorsPage.css
```

**2. `VendorsPage.jsx`** – list pages are built from the shared `ListPage` + column helpers:

```jsx
import ListPage from "@/components/ListPage/ListPage.jsx";
import TableLink from "@/components/TableLink/TableLink.jsx";
import { textColumn, statusColumn } from "@/components/DataTable/columnHelpers.jsx";
import { vendors } from "@/data/purchasingData.js";
import "./VendorsPage.css";

const columns = [
  { key: "name", label: "Vendor Name", sortable: true, render: (row) => <TableLink>{row.name}</TableLink> },
  textColumn("email", "Email"),
  textColumn("phone", "Phone"),
  statusColumn(),
];

export default function VendorsPage() {
  return (
    <ListPage
      className="vendors-page"
      eyebrow="PURCHASING" title="All Vendors" icon="fa-handshake"
      entity="vendors" searchPlaceholder="Search in Vendors"
      columns={columns} rows={vendors}
    />
  );
}
```

**3. `VendorsPage.css`** – page-only styles, scoped:

```css
.vendors-page {
  /* add Vendors-only styles here */
}
```

**4. Add the data** in `src/data/purchasingData.js` (each row needs a unique `id`):

```js
export const vendors = [
  { id: 1, name: "ABC Dairy", email: "sales@abcdairy.com", phone: "0123 456 789", status: "Active" },
];
```

**5. Register the page** in `src/pages/pageRegistry.js` – the key must be the **exact sidebar label**:

```js
import VendorsPage from "./Purchasing/Vendors/VendorsPage.jsx";

export const pageRegistry = {
  // ...existing pages
  Vendors: VendorsPage,
};
```

Done – clicking **Purchasing → Vendors** in the sidebar now opens your page instead of "Coming soon".

> Not a list page (a form, a report, a chart page)? Skip `ListPage`: build your own layout, use
> `<PageHeader />` for the title bar and `<div className="card">` for white panels.

## How to add a sidebar menu item

Open `src/data/navigationData.js`. Each entry is `{ label, icon, children? }`, where `icon` is a
[Font Awesome](https://fontawesome.com/icons) class name (free "solid" icons):

```js
{ label: "Purchasing", icon: "fa-cart-shopping", children: [
    { label: "Vendors", icon: "fa-handshake" },
] }
```

The `label` is what links the menu item to a page in `pageRegistry.js`.

## Data

All data is **sample data** kept in `src/data/`. To connect a real backend later, replace the exported arrays
with API calls (for example in a `useEffect`, or a data-fetching library) – the pages only need
the same row shape.

> `src/data/salesData.js` rows must each have a unique `id` (used for row selection in the table).

## Page status

| Sidebar item | Status |
| --- | --- |
| Dashboard | Done |
| Sales → Customers, Quotes, Retainer Invoices, Sales Orders, Invoices, Recurring Invoices, Delivery Challans, Payments Received, Credit Notes | Done (sample data) |
| Purchasing, Inventory, Manufacturing, Quality, Distribution, Accounting, Banking, Reports | Coming soon |
| Products, Customers (group), Suppliers, Warehouse, HR & Users, Settings | Coming soon |

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `vite: command not found` | Run `npm install` first |
| Icons show as empty squares | Check that `@fortawesome/fontawesome-free` is installed and imported in `main.jsx` |
| `Failed to resolve import "@/..."` | The `@` alias is defined in `vite.config.js`; restart `npm run dev` after editing it |
| My page shows "Coming soon" | The key in `pageRegistry.js` must match the sidebar label **exactly** (case, spaces, `&`) |
| A style from one page affects another | Scope it under the page class (`.invoices-page …`) – see [How styling works](#how-styling-works) |
| Port 5173 is busy | Vite picks the next free port automatically – read the URL it prints |


## Order Hub module

Ported from `Zulekha_Order_Hub.html` using the ERP's own theme, `ListPage` / `DataTable` / `PageHeader` / `StatusPill` / `SummaryStrip`.
The prototype's 3 logins (Client, Area Manager, Admin) became sidebar groups under the **Order Hub** heading. There is no login inside the ERP:
the Client Portal and Area Manager pages have a **"Viewing as"** dropdown instead.

| Sidebar group | Menus |
| --- | --- |
| Client Portal | Client Dashboard, Place Order, My Invoices, Account Statement, My Offers, My Details, Client Demo Script |
| Area Manager | Manager Dashboard, Register a Visit (GPS + photo), Client Orders, Place Order for Client, Manager Demo Script |
| Fulfilment & Logistics | Orders, POD Matching, POD Auto-Match (AI), Backorders, Shipping (DPD), Admin Demo Script |
| Sales & Marketing | Products & Pricing, Promotions, Sales Reporting |
| Finance & Credit | Accounting / Invoices, Credit Control |
| Supply Chain | Stock & Expiry, Demand Forecasting (AI) |
| System & Admin | Audit Log, AI Automation Ideas |
| Purchasing (existing group) | **Purchase Orders**, **Goods Received** now open the Order Hub pages |

Where things are:

| What | File |
| --- | --- |
| All Order Hub data + every action (place order, POD match, invoice, PO ...) | `src/data/orderHubStore.js` |
| Pages | `src/pages/OrderHub/{Client,Manager,Admin,DemoScript}/...` |
| Shared bits (cards, fields, buttons, modal, "Viewing as") | `src/components/HubUI/` |
| Order catalogue form (Place Order + Place Order for Client) | `src/components/OrderForm/` |
| Sidebar menu definition | `src/data/navigationData.js` (`navOrderHub`) |

Data is in-memory sample data (resets on reload), same as the prototype. To go live, replace the action functions in `orderHubStore.js` with API calls.

## Login & role-based menus
`src/pages/Login/` is the login screen. Pick Client / Area Manager / Admin (or ERP Administrator) and an identity; the sidebar then shows only that role's menus.
Menus per role live in `src/data/roleNavigation.js`; login state is kept in `App.jsx` (sessionStorage, demo only — no real authentication).

---

## Data & login (frontend only — no backend)

This project is **frontend only**. There is no Node/MySQL server any more.

- **Order Hub data** (orders, invoices, POD, purchase orders, stock, pricing, promotions, visits) is kept in the browser's
  `localStorage` by `src/data/localDb.js`. All business rules (credit limit, promo, VAT invoice, backorders ...) run there.
- **ERP records** (Customers, Invoices, any module's New/Edit/Delete) are stored by `src/data/erpApi.js`, also in `localStorage`.
- **Login / Register** is handled by `src/data/authStore.js` (username + password + role). Passwords are stored hashed
  (PBKDF2-SHA256 + salt). Sessions last until the tab closes, or until sign-out if "Remember me" is ticked.
- Data is per browser. To reset everything: DevTools → Application → Local Storage → clear `meg-*` keys.
- To connect a real server later, keep the same function names in `localDb.js`/`erpApi.js`/`authStore.js` and swap their insides for `fetch` calls.

### Demo accounts (created on first run)

| Role | Username | Password |
|---|---|---|
| ERP Administrator | `admin` | `Admin@123` |
| Admin / Back office | `backoffice` | `Office@123` |
| Area Manager | `priya` / `tom` | `Priya@123` / `Tom@123` |
| Client | `spice` / `greenleaf` / `alnoor` / `riverside` | `Spice@123` / `Green@123` / `Alnoor@123` / `River@123` |

New users can use the **Register** tab. Client registration creates a new client account; Area Manager registration lets
you choose which clients you cover; Admin and ERP Administrator registration needs the access code in
`ADMIN_ACCESS_CODE` (`src/data/authStore.js`, default `MEG-ADMIN-2026`) — change it before sharing.

