import "./SidebarNav.css";

export default function SidebarNav({ items, collapsed, activeLabel, onSelect, openLabel, onToggle }) {
  return (
    <ul className="nav-list">
      {items.map(({ label, icon, children }) => {
        const hasChildren = Array.isArray(children) && children.length > 0;
        const childActive = hasChildren && children.some((c) => c.label === activeLabel);
        const isActive = !hasChildren && activeLabel === label;
        const isOpen = !collapsed && hasChildren && openLabel === label;

        return (
          <li key={label}>
            <button
              type="button"
              className={`nav-item${isActive ? " active" : ""}${childActive ? " has-active-child" : ""}${isOpen ? " open" : ""}`}
              onClick={() => (hasChildren ? onToggle(label) : onSelect(label))}
              title={collapsed ? label : undefined}
              aria-expanded={hasChildren ? isOpen : undefined}
            >
              <i className={`fa-solid ${icon} nav-fa`} aria-hidden="true" />
              {!collapsed && <span className="nav-label">{label}</span>}
              {!collapsed && hasChildren && <i className="fa-solid fa-chevron-right nav-chevron" aria-hidden="true" />}
            </button>

            {hasChildren && (
              <div className={`nav-sub-wrap${isOpen ? " open" : ""}`}>
                <ul className="nav-sub">
                  {children.map((c, i) => (
                    <li key={c.label} style={{ "--i": i }}>
                      <button
                        type="button"
                        tabIndex={isOpen ? 0 : -1}
                        className={`nav-sub-item${activeLabel === c.label ? " active" : ""}`}
                        onClick={() => onSelect(c.label)}
                      >
                        <i className={`fa-solid ${c.icon} sub-fa`} aria-hidden="true" />
                        <span>{c.label}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
