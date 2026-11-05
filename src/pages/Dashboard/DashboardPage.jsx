import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  CalendarDays, CalendarRange, CalendarCheck, CalendarClock, Sun,
  ChevronDown, RefreshCw, Check, X,
} from "lucide-react";
import PageHeader from "@/components/PageHeader/PageHeader.jsx";
import StatCard from "./components/StatCard/StatCard.jsx";
import SalesTrendChart from "./components/SalesTrendChart/SalesTrendChart.jsx";
import ProductionOverview from "./components/ProductionOverview/ProductionOverview.jsx";
import LowStockAlerts from "./components/LowStockAlerts/LowStockAlerts.jsx";
import RecentSalesOrders from "./components/RecentSalesOrders/RecentSalesOrders.jsx";
import TodayActivity from "./components/TodayActivity/TodayActivity.jsx";
import InsightCharts from "./components/InsightCharts/InsightCharts.jsx";
import MoreCharts from "./components/MoreCharts/MoreCharts.jsx";
import { topStats, secondaryStats } from "@/data/dashboardData.js";
import { currentUser } from "@/data/authStore.js";
import "./DashboardPage.css";

/* ---------- date range helpers ---------- */
const PRESETS = [
  { id: "today", label: "Today", icon: Sun },
  { id: "week", label: "This Week", icon: CalendarClock },
  { id: "month", label: "This Month", icon: CalendarDays },
  { id: "quarter", label: "This Quarter", icon: CalendarRange },
  { id: "year", label: "This Year", icon: CalendarCheck },
  { id: "custom", label: "Custom range" },
];
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fmt = (d) => d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
const short = (d) => d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
const startOf = (id, now = new Date()) => {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (id === "week") d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Monday
  if (id === "month") d.setDate(1);
  if (id === "quarter") { d.setMonth(Math.floor(d.getMonth() / 3) * 3); d.setDate(1); }
  if (id === "year") { d.setMonth(0); d.setDate(1); }
  return d;
};
const daysBetween = (a, b) => Math.max(1, Math.round((b - a) / 86400000) + 1);

/* name shown in the greeting: the signed-in person's first name (a client shows the company name as it is) */
const greetingName = (user) => {
  const full = String(user?.name || "").trim();
  if (!full) return user?.username || "there";
  return user?.role === "client" ? full : full.split(/\s+/)[0];
};

/* Same stat always gets the same small variation, so cards do not all move together */
const jitter = (str) => { let h = 0; for (const c of str) h = (h * 31 + c.charCodeAt(0)) >>> 0; return 0.9 + (h % 21) / 100; };

function scaleValue(v, k) {
  if (typeof v === "number") return Number.isInteger(v) ? Math.round(v * k) : Math.round(v * k * 100) / 100;
  if (typeof v === "string") {
    if (v.includes("%")) return v; // percentages do not scale with the period
    const m = v.match(/\d[\d,]*(\.\d+)?/);
    if (!m) return v;
    const dec = m[1] ? m[1].length - 1 : 0;
    const scaled = parseFloat(m[0].replace(/,/g, "")) * k;
    return v.replace(m[0], scaled.toLocaleString("en-GB", { minimumFractionDigits: dec, maximumFractionDigits: dec }));
  }
  return v;
}
const scaleStat = (s, k) => ({ ...s, value: scaleValue(s.value, k * jitter(String(s.id ?? s.label))) });

/* ---------- date range popup (centered modal) ----------
   Rendered through a portal inside .app (dark-mode variables still apply),
   so the banner's overflow:hidden can never cut it. */
function DateRangePicker({ range, onChange }) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(iso(startOf("month")));
  const [to, setTo] = useState(iso(new Date()));
  const btnRef = useRef(null);

  // Esc closes the popup
  useEffect(() => {
    if (!open) return;
    const esc = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [open]);

  const pick = (id) => {
    onChange({ id, from: startOf(id), to: new Date() });
    setOpen(false);
  };

  const a = new Date(from), b = new Date(to);
  const validCustom = !isNaN(a) && !isNaN(b) && a <= b;
  const customDays = validCustom ? daysBetween(a, b) : 0;

  const applyCustom = () => {
    if (!validCustom) return;
    onChange({ id: "custom", from: a, to: b });
    setOpen(false);
  };

  const label = PRESETS.find((p) => p.id === range.id)?.label;
  const host = btnRef.current?.closest(".app") || document.body;
  const today = new Date();

  const popup = (
    <div className="date-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div className="date-menu" role="dialog" aria-modal="true" aria-label="Select period">
        <div className="dm-head">
          <div className="dm-head-text">
            <span className="dm-title">Select period</span>
            <span className="dm-sub">Dashboard data will update</span>
          </div>
          <button type="button" className="dm-close" onClick={() => setOpen(false)} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="dm-list" role="listbox">
          {PRESETS.filter((p) => p.id !== "custom").map((p, i) => {
            const Icon = p.icon;
            const active = range.id === p.id;
            const hint = p.id === "today" ? fmt(today) : `${short(startOf(p.id))} - ${short(today)}`;
            return (
              <button
                key={p.id}
                type="button"
                role="option"
                aria-selected={active}
                className={`date-opt ${active ? "active" : ""}`}
                style={{ animationDelay: `${i * 0.04}s` }}
                onClick={() => pick(p.id)}
              >
                <span className="opt-ico"><Icon size={16} /></span>
                <span className="opt-text">
                  <b>{p.label}</b>
                  <small>{hint}</small>
                </span>
                <span className="opt-check">{active && <Check size={14} />}</span>
              </button>
            );
          })}
        </div>

        <div className={`date-custom ${range.id === "custom" ? "active" : ""}`}>
          <div className="date-custom-title">
            <CalendarRange size={13} /> Custom range
            {validCustom && <em>{customDays} day{customDays > 1 ? "s" : ""}</em>}
          </div>
          <div className="dc-row">
            <label>
              <span>From</span>
              <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label>
              <span>To</span>
              <input type="date" value={to} min={from} max={iso(new Date())} onChange={(e) => setTo(e.target.value)} />
            </label>
          </div>
          <button type="button" className="date-apply" disabled={!validCustom} onClick={applyCustom}>
            Apply range
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="date-wrap">
      <button
        ref={btnRef}
        type="button"
        className={`date-btn ${open ? "open" : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <CalendarDays size={18} />
        <span>{label}: {fmt(range.from)}{range.id === "today" ? "" : ` - ${fmt(range.to)}`}</span>
        <ChevronDown size={16} className="date-chev" />
      </button>

      {open && createPortal(popup, host)}
    </div>
  );
}

/* ---------- page ---------- */
/* onNavigate comes from App.jsx (<Page onNavigate={setActivePage} />) -> used by the "View All" links */
export default function DashboardPage({ onNavigate }) {
  const [range, setRange] = useState({ id: "month", from: startOf("month"), to: new Date() });
  const [refreshKey, setRefreshKey] = useState(0);
  const [spinning, setSpinning] = useState(false);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";
  const userName = useMemo(() => greetingName(currentUser()), []);

  /* data for the chosen period: 1.0 = a 30-day period */
  const k = daysBetween(range.from, range.to) / 30;
  const kpis = useMemo(() => topStats.map((s) => scaleStat(s, k)), [k]);
  const minis = useMemo(() => secondaryStats.map((s) => scaleStat(s, k)), [k]);

  const refresh = () => {
    setSpinning(true);
    setRefreshKey((n) => n + 1); // remounts the cards so the animations play again
    setTimeout(() => setSpinning(false), 700);
  };

  const actions = (
    <div className="dash-actions">
      <DateRangePicker range={range} onChange={setRange} />
      <button type="button" className="dash-refresh" onClick={refresh} aria-label="Refresh dashboard" title="Refresh">
        <RefreshCw size={17} className={spinning ? "spin" : ""} />
      </button>
    </div>
  );

  /* key changes on range/refresh -> cards remount -> fade-in + count-up play again */
  const bodyKey = `${range.id}-${iso(range.from)}-${iso(range.to)}-${refreshKey}`;

  return (
    <div className="dashboard-page">
      <PageHeader
        eyebrow="EXECUTIVE DASHBOARD"
        title={<>{greeting}, <span>{userName}!</span></>}
        subtitle="Here's your complete business overview."
        actions={actions}
      />

      <div className="dash-anim" key={bodyKey}>
        {/* Row 1: four big KPI cards */}
        <div className="grid kpi-grid">
          {kpis.map((s) => <StatCard key={s.id} variant="kpi" {...s} />)}
        </div>

        {/* Row 2: five small cards */}
        <div className="grid mini-grid">
          {minis.map((s) => <StatCard key={s.id} variant="mini" {...s} />)}
        </div>

        {/* Row 3: charts */}
        <div className="grid chart-grid">
          <SalesTrendChart range={range} />
          <ProductionOverview range={range} />
        </div>

        {/* Row 4: tables + activity */}
        <div className="grid bottom-grid">
          <LowStockAlerts range={range} onNavigate={onNavigate} />
          <RecentSalesOrders range={range} onNavigate={onNavigate} />
          <TodayActivity range={range} onNavigate={onNavigate} />
        </div>

        {/* Row 5 + 6: animated insight charts */}
        <InsightCharts range={range} k={k} />

        {/* Row 7 + 8: more animated charts */}
        <MoreCharts k={k} />
      </div>
    </div>
  );
}