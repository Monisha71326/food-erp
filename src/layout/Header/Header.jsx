import { useEffect, useRef, useState } from "react";
import {
  Menu, Search, Building2, ChevronDown, Bell, Moon, Sun, LogOut, X,
  Package, ShoppingCart, Users, Truck, CheckCheck, AlertTriangle, FileText, Clock,
} from "lucide-react";
import "./Header.css";

const SCOPES = [
  { key: "all", label: "All", icon: Search },
  { key: "products", label: "Products", icon: Package },
  { key: "orders", label: "Orders", icon: ShoppingCart },
  { key: "customers", label: "Customers", icon: Users },
  { key: "suppliers", label: "Suppliers", icon: Truck },
];

const RECENT = ["Low stock items", "Pending sales orders", "Invoices this month", "Spice Garden Ltd"];

const NOTIFICATIONS = [
  { id: 1, icon: AlertTriangle, tone: "red", title: "Low stock alert", text: "3 items below reorder level", time: "5m ago" },
  { id: 2, icon: FileText, tone: "blue", title: "New invoice created", text: "INV-2026-0148 for £1,240", time: "32m ago" },
  { id: 3, icon: ShoppingCart, tone: "green", title: "Order confirmed", text: "SO-0097 approved by manager", time: "1h ago" },
];

export default function Header({ onToggleSidebar, dark, onToggleDark, user, role, onLogout }) {
  const rootRef = useRef(null);
  const searchRef = useRef(null);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState("all");
  const [menu, setMenu] = useState(null); // null | "search" | "notif"
  const [unread, setUnread] = useState(NOTIFICATIONS.length);

  // Ctrl/Cmd + K -> search focus, Esc -> popup close
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
        setMenu("search");
      }
      if (e.key === "Escape") setMenu(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // veliya click panna dropdown close
  useEffect(() => {
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setMenu(null);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const displayName = user.name.replace(/ \(.*\)$/, "");
  const initials = displayName.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const activeScope = SCOPES.find((s) => s.key === scope);

  const pickRecent = (text) => {
    setQuery(text);
    searchRef.current?.focus();
  };

  return (
    <header className="topbar" ref={rootRef}>
      <button type="button" className="hd-btn" onClick={onToggleSidebar} aria-label="Toggle sidebar">
        <Menu size={21} />
      </button>

      {/* ---------- SEARCH (command palette style) ---------- */}
      <div className="search-wrap">
        <div className="search">
          <Search size={17} className="search-icon" />
          <input
            ref={searchRef}
            type="text"
            value={query}
            onFocus={() => setMenu("search")}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setQuery("");
                setMenu(null);
                e.currentTarget.blur();
              }
            }}
            placeholder={
              scope === "all"
                ? "Search products, orders, customers, suppliers..."
                : `Search in ${activeScope.label.toLowerCase()}...`
            }
          />
          {query && (
            <button type="button" className="search-clear" onClick={() => setQuery("")} aria-label="Clear search">
              <X size={13} />
            </button>
          )}
        </div>

        {menu === "search" && (
          <div className="dropdown search-panel">
            <div className="panel-label">Search in</div>
            <div className="scope-row">
              {SCOPES.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  className={`scope-chip ${scope === key ? "active" : ""}`}
                  onClick={() => { setScope(key); searchRef.current?.focus(); }}
                >
                  <Icon size={13} /> {label}
                </button>
              ))}
            </div>

            <div className="panel-label">Recent</div>
            {RECENT.map((r) => (
              <button key={r} type="button" className="recent-item" onClick={() => pickRecent(r)}>
                <Clock size={14} /> <span>{r}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ---------- RIGHT SIDE ---------- */}
      <div className="topbar-right">
        <button type="button" className="company-select">
          <span className="company-ico"><Building2 size={15} /></span>
          <span className="company-name">Mega Foods Ltd</span>
          <ChevronDown size={14} />
        </button>

        <div className="notif-wrap">
          <button
            type="button"
            className="hd-btn bell"
            aria-label="Notifications"
            aria-expanded={menu === "notif"}
            onClick={() => setMenu(menu === "notif" ? null : "notif")}
          >
            <Bell size={19} />
            {unread > 0 && <span className="badge">{unread}</span>}
          </button>

          {menu === "notif" && (
            <div className="dropdown notif-panel">
              <div className="notif-head">
                <strong>Notifications</strong>
                <button type="button" className="mark-read" onClick={() => setUnread(0)}>
                  <CheckCheck size={14} /> Mark all read
                </button>
              </div>
              {NOTIFICATIONS.map(({ id, icon: Icon, tone, title, text, time }) => (
                <div key={id} className={`notif-item ${unread === 0 ? "read" : ""}`}>
                  <span className={`notif-ico ${tone}`}><Icon size={15} /></span>
                  <div className="notif-body">
                    <b>{title}</b>
                    <span>{text}</span>
                  </div>
                  <small>{time}</small>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* sliding theme switch */}
        <button
          type="button"
          className={`theme-switch ${dark ? "on" : ""}`}
          onClick={onToggleDark}
          aria-label="Toggle dark mode"
          title={dark ? "Light mode" : "Dark mode"}
        >
          <Sun size={13} className="ts-sun" />
          <Moon size={13} className="ts-moon" />
          <span className="ts-thumb">{dark ? <Moon size={12} /> : <Sun size={12} />}</span>
        </button>

        <span className="topbar-divider" />

        <button type="button" className="user">
          <span className="avatar-ring">
            <span className="avatar">{initials}</span>
            <i className="online-dot" />
          </span>
          <span className="user-meta">
            <strong>{displayName}</strong>
            <small>{role.subtitle}</small>
          </span>
        </button>

        <button type="button" className="hd-btn logout-btn" onClick={onLogout} aria-label="Log out" title="Log out">
          <LogOut size={19} />
        </button>
      </div>
    </header>
  );
}