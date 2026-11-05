/* Sample data for the Executive Dashboard page (replace with API calls later). */

/* ---------- KPI cards ---------- */
export const topStats = [
  { id: "sales", label: "Total Sales", value: "£48,250", change: 12, sub: "vs last month", tone: "red", icon: "cart", color: "#9a0f2e", spark: [8, 10, 9, 12, 11, 16, 20, 26] },
  { id: "purchases", label: "Total Purchases", value: "£32,400", change: 5, sub: "vs last month", tone: "blue", icon: "file", color: "#3b6fe0", spark: [10, 12, 11, 15, 14, 19, 23, 27] },
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

export const activities = [
  { time: "09:15", text: "5 products are below minimum stock level", icon: "alert", color: "#c8102e" },
  { time: "08:40", text: "Production order PO-204 started", icon: "cog", color: "#14214a" },
  { time: "08:20", text: "New sales order SO-1005 from Waitrose", icon: "file", color: "#3b6fe0" },
  { time: "07:50", text: "Bank transactions imported (12 records)", icon: "bank", color: "#14214a" },
  { time: "07:30", text: "Purchase order PO-2001 received", icon: "box", color: "#f08a1c" },
];
