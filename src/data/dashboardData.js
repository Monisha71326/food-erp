/* Sample data for the Executive Dashboard page (replace with API calls later). */

/* ---------- KPI cards ---------- */
export const topStats = [
  { id: "sales", label: "Total Sales", value: "£48,250", change: 12, sub: "vs last month", tone: "red", icon: "cart", color: "#9a0f2e", spark: [8, 10, 9, 12, 11, 16, 20, 26] },
  { id: "purchases", label: "Total Orders", value: "£32,400", change: 5, sub: "vs last month", tone: "blue", icon: "file", color: "#3b6fe0", spark: [10, 12, 11, 15, 14, 19, 23, 27] },
  { id: "stock", label: "Stock Value", value: "£186,750", change: 3, sub: "vs last month", tone: "orange", icon: "box", color: "#f08a1c", spark: [14, 12, 15, 13, 17, 15, 20, 18] },
  { id: "batches", label: "Production Batches", value: "12", change: 20, sub: "vs last week", tone: "purple", icon: "factory", color: "#7c3aed", spark: [8, 11, 9, 13, 12, 18, 22, 28] },
];

export const secondaryStats = [
  { id: "recv", label: "Outstanding Receivables", value: "£28,450", change: -8, sub: "vs last month", icon: "users" },
  { id: "bank", label: "Bank Balance", value: "£96,230", change: 4, sub: "vs last month", icon: "bank" },
  { id: "low", label: "Low Stock Items", value: "8", sub: "Require attention", icon: "alert" },
  { id: "orders", label: "Open Sales Orders", value: "18", sub: "£74,200 value", icon: "calendar" },
  { id: "deliv", label: "Deliveries Today", value: "6", sub: "Out of 8 orders", icon: "truck" },
];

/* ---------- Charts ---------- */
export const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const salesSeries = [33000, 39000, 45000, 53000, 44000, 42000, 36000, 42000, 42000, 50000, 55000, 58400];
export const purchaseSeries = [20000, 26000, 27000, 36000, 30000, 26000, 21000, 29000, 25000, 31000, 37000, 33000];

/* kept for reference; Production Overview now reads orderLines below */
export const production = [
  { label: "Completed", value: 8, color: "#9a0f2e" },
  { label: "In Progress", value: 2, color: "#14214a" },
  { label: "Planned", value: 2, color: "#e8a7b3" },
  { label: "Delayed", value: 0, color: "#cfd5de" },
];

/* ---------- Tables ---------- */
export const lowStock = [
  { product: "Chicken Breast 1kg", current: 8, min: 20 },
  { product: "Cheddar Cheese 500g", current: 10, min: 25 },
  { product: "Fresh Milk 1L", current: 15, min: 50 },
  { product: "Wheat Flour 25kg", current: 5, min: 20 },
  { product: "Tomato Sauce 5kg", current: 6, min: 30 },
];

export const recentOrders = [
  { no: "SO-1001", customer: "Tesco", amount: "£5,240", status: "Confirmed" },
  { no: "SO-1002", customer: "Sainsbury's", amount: "£3,120", status: "Picking" },
  { no: "SO-1003", customer: "Morrisons", amount: "£4,860", status: "Dispatched" },
  { no: "SO-1004", customer: "ASDA", amount: "£2,940", status: "Pending" },
  { no: "SO-1005", customer: "Waitrose", amount: "£6,120", status: "Confirmed" },
];

/* ---------- Order lines (one row per product in an order) ----------
   Used by Production Overview (category-wise and product-wise split).
   orderNo links to recentOrders[].no.
   Replace with API data later: same shape { orderNo, date, product, category, qty }. */
export const orderLines = [
  // SO-1001 Tesco
  { orderNo: "SO-1001", date: "2026-11-02", product: "Basmati Rice 5kg",    category: "Other",     qty: 120 },
  { orderNo: "SO-1001", date: "2026-11-02", product: "Sunflower Oil 5L",    category: "Other",     qty: 80 },
  { orderNo: "SO-1001", date: "2026-11-02", product: "Tea Bags 440s",       category: "Beverages", qty: 150 },
  // SO-1002 Sainsbury's
  { orderNo: "SO-1002", date: "2026-11-03", product: "Mango Pulp 850g",     category: "Beverages", qty: 200 },
  { orderNo: "SO-1002", date: "2026-11-03", product: "Salted Crisps 150g",  category: "Snacks",    qty: 140 },
  // SO-1003 Morrisons
  { orderNo: "SO-1003", date: "2026-11-05", product: "Chickpeas 1kg",       category: "Other",     qty: 90 },
  { orderNo: "SO-1003", date: "2026-11-05", product: "Cheese Puffs 90g",    category: "Snacks",    qty: 110 },
  { orderNo: "SO-1003", date: "2026-11-05", product: "Fresh Milk 1L",       category: "Dairy",     qty: 160 },
  // SO-1004 ASDA
  { orderNo: "SO-1004", date: "2026-11-07", product: "Frozen Peas 1kg",     category: "Frozen",    qty: 70 },
  { orderNo: "SO-1004", date: "2026-11-07", product: "Mango Pulp 850g",     category: "Beverages", qty: 60 },
  // SO-1005 Waitrose
  { orderNo: "SO-1005", date: "2026-11-09", product: "Cheddar Cheese 500g", category: "Dairy",     qty: 130 },
  { orderNo: "SO-1005", date: "2026-11-09", product: "Tea Bags 440s",       category: "Beverages", qty: 100 },
  { orderNo: "SO-1005", date: "2026-11-09", product: "Frozen Samosa 20pc",  category: "Frozen",    qty: 85 },
  // earlier orders, so Quarter / Year views have more data
  { orderNo: "SO-0988", date: "2026-10-12", product: "Fresh Milk 1L",       category: "Dairy",     qty: 210 },
  { orderNo: "SO-0988", date: "2026-10-12", product: "Salted Crisps 150g",  category: "Snacks",    qty: 180 },
  { orderNo: "SO-0975", date: "2026-09-18", product: "Tea Bags 440s",       category: "Beverages", qty: 240 },
  { orderNo: "SO-0975", date: "2026-09-18", product: "Frozen Peas 1kg",     category: "Frozen",    qty: 150 },
  { orderNo: "SO-0951", date: "2026-07-22", product: "Basmati Rice 5kg",    category: "Other",     qty: 300 },
  { orderNo: "SO-0951", date: "2026-07-22", product: "Chickpeas 1kg",       category: "Other",     qty: 190 },
  { orderNo: "SO-0902", date: "2026-03-05", product: "Cheese Puffs 90g",    category: "Snacks",    qty: 260 },
  { orderNo: "SO-0902", date: "2026-03-05", product: "Cheddar Cheese 500g", category: "Dairy",     qty: 140 },
];

/* ---------- Activity ----------
   "by" = who did it. The card shows only "Area Manager" entries.
   The "System" entries are kept here, just not shown. */
const allActivities = [
  { time: "09:15", by: "System", text: "5 products are below minimum stock level", icon: "alert", color: "#c8102e" },
  { time: "09:05", by: "Area Manager", text: "Visited Tesco store, order of £5,240 confirmed", icon: "cart", color: "#c8102e" },
  { time: "08:40", by: "Area Manager", text: "Approved sales order SO-1005 from Waitrose", icon: "file", color: "#3b6fe0" },
  { time: "08:40", by: "System", text: "Production order PO-204 started", icon: "cog", color: "#14214a" },
  { time: "08:20", by: "Area Manager", text: "Updated delivery plan for 6 orders", icon: "truck", color: "#14214a" },
  { time: "07:50", by: "Area Manager", text: "Met Sainsbury's team, new order discussed", icon: "users", color: "#f08a1c" },
  { time: "07:50", by: "System", text: "Bank transactions imported (12 records)", icon: "bank", color: "#14214a" },
  { time: "07:30", by: "Area Manager", text: "Reviewed ASDA stock levels, reorder requested", icon: "box", color: "#f08a1c" },
  { time: "07:30", by: "System", text: "Purchase order PO-2001 received", icon: "box", color: "#f08a1c" },
];
/* Today's Activity shows only area manager activity */
export const activities = allActivities.filter((a) => a.by === "Area Manager");