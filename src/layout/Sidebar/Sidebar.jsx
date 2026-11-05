import { useState } from "react";
import SidebarNav from "./SidebarNav.jsx";
import logo from "@/assets/logo.webp";
import "./Sidebar.css";

function Logo({ collapsed }) {
  return (
    <div className="brand">
      <img
        src={logo}
        alt="Meg World Technologies - Food Manufacturing ERP"
        className={collapsed ? "brand-img collapsed" : "brand-img"}
      />
    </div>
  );
}

export default function Sidebar({ collapsed, open, active, sections, onSelect, onClose, onExpand }) {
  // only one dropdown open at a time (across both nav lists)
  const [openLabel, setOpenLabel] = useState(null);

  const toggle = (label) => {
    if (collapsed) {
      onExpand?.();
      setOpenLabel(label);
      return;
    }
    setOpenLabel((cur) => (cur === label ? null : label));
  };

  const navProps = { collapsed, activeLabel: active, onSelect, openLabel, onToggle: toggle };

  return (
    <>
      <div className={`sidebar-backdrop${open ? " show" : ""}`} onClick={onClose} />
      <aside className={`sidebar${collapsed ? " collapsed" : ""}${open ? " open" : ""}`}>
        <Logo collapsed={collapsed} />

        <nav className="sidebar-scroll">
          {sections.map((sec, i) => (
            <div key={i}>
              {i > 0 && <hr className="nav-divider" />}
              {sec.title && !collapsed && <p className="nav-section">{sec.title}</p>}
              <SidebarNav items={sec.items} {...navProps} />
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}