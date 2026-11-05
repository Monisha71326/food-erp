import { useEffect, useState } from "react";
import Sidebar from "@/layout/Sidebar/Sidebar.jsx";
import Header from "@/layout/Header/Header.jsx";
import "./MainLayout.css";

/* App shell: sidebar + header + the page content. Also owns sidebar/dark-mode state. */
export default function MainLayout({ children, activePage, onNavigate, user, role, onLogout }) {
  const [collapsed, setCollapsed] = useState(false);   // desktop: icon-only sidebar
  const [mobileOpen, setMobileOpen] = useState(false); // mobile: slide-in drawer
  const [dark, setDark] = useState(false);

  const toggleSidebar = () => {
    if (window.matchMedia("(max-width: 900px)").matches) setMobileOpen((v) => !v);
    else setCollapsed((v) => !v);
  };

  // jump to top whenever the page changes
  useEffect(() => { window.scrollTo({ top: 0 }); }, [activePage]);

  return (
    <div className={`app${dark ? " dark" : ""}${collapsed ? " is-collapsed" : ""}`}>
      <Sidebar
        collapsed={collapsed}
        open={mobileOpen}
        active={activePage}
        sections={role.sections}
        onLogout={onLogout}
        onSelect={(label) => { onNavigate(label); setMobileOpen(false); }}
        onExpand={() => setCollapsed(false)}
        onClose={() => setMobileOpen(false)}
      />
      <div className="main">
        <Header onToggleSidebar={toggleSidebar} dark={dark} onToggleDark={() => setDark((v) => !v)} user={user} role={role} onLogout={onLogout} />
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
