import { useRef } from "react";
import { printElement } from "@/utils/print.js";
import "./PageHeader.css";

/*
 * <PageHeader eyebrow title subtitle icon actions showPrint />
 *  - icon       : Font Awesome class, e.g. "fa-users"
 *  - showPrint  : shows the Print button (default true). Pass showPrint={false} on a page that must not have it.
 *  Print button prints the whole page that contains this header (its parent element).
 */
export default function PageHeader({ eyebrow, title, subtitle, icon, actions, showPrint = true }) {
  const headerRef = useRef(null);
  const dateRef = useRef(null);

  const handlePrint = () => {
    if (dateRef.current) dateRef.current.textContent = `Printed on ${new Date().toLocaleString()}`;
    printElement(headerRef.current?.parentElement);
  };

  return (
    <header className="ph" ref={headerRef}>
      <span className="ph-glow ph-glow-a" aria-hidden="true" />
      <span className="ph-glow ph-glow-b" aria-hidden="true" />

      <div className="ph-left">
        {icon && (
          <span className="ph-icon">
            <i className={`fa-solid ${icon}`} aria-hidden="true" />
          </span>
        )}

        <div className="ph-text">
          {eyebrow && (
            <span className="ph-eyebrow">
              <span className="ph-dot" />
              {eyebrow}
            </span>
          )}
          <h1 className="ph-title">{title}</h1>
          {subtitle && <p className="ph-sub">{subtitle}</p>}
          <span className="ph-print-date" ref={dateRef} />
        </div>
      </div>

      {(actions || showPrint) && (
        <div className="ph-actions">
          {actions}
          {showPrint && (
            <button type="button" className="ph-print" onClick={handlePrint} title="Print this page" aria-label="Print this page">
              <i className="fa-solid fa-print" aria-hidden="true" /> Print
            </button>
          )}
        </div>
      )}
    </header>
  );
}