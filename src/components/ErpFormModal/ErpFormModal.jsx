import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./ErpFormModal.css";

/*
 * Shared create / edit dialog used by ListPage and GenericModulePage.
 *  - rendered into document.body, so sticky headers / animated page wrappers can never clip it
 *  - gradient header with a live "% complete" progress bar
 *  - side rail with section steps (click to jump, tick when done) when the form has 2+ sections
 *  - every section title has its own icon
 *  - short dropdowns (status, priority, payment method, share-via ...) become colour-coded choice chips;
 *    chips for Email / WhatsApp / SMS / Post show their own icon
 *  - input icons: WhatsApp (green brand icon), Pincode (map pin), "Send invoices to" (paper plane) ...
 *  - live validation (email / link / phone), green tick when a field is valid, character counter on notes
 *  - every field gets a helpful placeholder (own `placeholder`, otherwise generated from key / type / label)
 *  - Ctrl/Cmd + Enter saves, Esc closes, smooth enter / exit animation
 *  - field = { key, label, type, options, required, wide, placeholder, min, section }
 *  - type "multi" = several numbers in one field (one input per number + "Add number" button).
 *    The value is stored as ONE string: "n1, n2, n3"
 */

const filled = (value) => String(value ?? "").trim() !== "";

/* "multi" field: stored string <-> list of rows (empty rows are kept while typing) */
const MULTI_MAX = 5;
const multiItems = (value) => {
  const list = String(value ?? "").split(",").map((s) => s.trim());
  return list.length ? list : [""];
};

/* [regex on "key type", icon classes, optional tone] */
const ICON_RULES = [
  [/whatsapp/, "fa-brands fa-whatsapp", "whatsapp"],
  [/pincode|postcode|postal|zip/, "fa-solid fa-map-pin"],
  [/shareto/, "fa-solid fa-paper-plane"],
  [/email/, "fa-solid fa-envelope"],
  [/phone|mobile|tel/, "fa-solid fa-phone"],
  [/website|url/, "fa-solid fa-globe"],
  [/company|supplier|vendor|department/, "fa-solid fa-building"],
  [/name|customer|contact|owner|assigned|payee/, "fa-solid fa-user"],
  [/amount|price|total|receivable|credit|budget|limit/, "fa-solid fa-coins"],
  [/date|expiry|due/, "fa-solid fa-calendar-days"],
  [/time/, "fa-solid fa-clock"],
  [/^(ref|id)$|number|reference|code|sku|id$/, "fa-solid fa-hashtag"],
  [/source/, "fa-solid fa-bullseye"],
  [/location|storage/, "fa-solid fa-location-dot"],
  [/role|designation/, "fa-solid fa-id-badge"],
];
const iconFor = (field) => {
  if (field.type === "textarea" || field.type === "select") return null;
  const text = `${String(field.key).toLowerCase()} ${field.type || ""}`;
  const hit = ICON_RULES.find(([re]) => re.test(text));
  return hit ? { cls: hit[1], tone: hit[2] || "" } : null;
};

/* icon in front of each section title */
const SECTION_ICONS = {
  "basic details": "fa-solid fa-id-card",
  contact: "fa-solid fa-address-book",
  account: "fa-solid fa-wallet",
  "address & notes": "fa-solid fa-location-dot",
  "invoice sharing": "fa-solid fa-paper-plane",
  personal: "fa-solid fa-user",
  "job details": "fa-solid fa-briefcase",
  item: "fa-solid fa-box",
  "stock & price": "fa-solid fa-tags",
  order: "fa-solid fa-cart-shopping",
  details: "fa-solid fa-circle-info",
  dates: "fa-solid fa-calendar-days",
  payment: "fa-solid fa-credit-card",
  team: "fa-solid fa-people-group",
  schedule: "fa-solid fa-calendar-check",
  description: "fa-solid fa-align-left",
  notes: "fa-solid fa-note-sticky",
};
const sectionIcon = (title) => SECTION_ICONS[String(title).toLowerCase()] || null;

/* icon inside a choice chip (only for the share-via options) */
const CHIP_ICONS = [
  [/^whatsapp$/i, "fa-brands fa-whatsapp"],
  [/^email$/i, "fa-solid fa-envelope"],
  [/^sms$/i, "fa-solid fa-message"],
  [/^post$/i, "fa-solid fa-envelope-open-text"],
];
const chipIconOf = (option) => CHIP_ICONS.find(([re]) => re.test(String(option)))?.[1] || null;

/* Placeholder shown inside an empty input. Date / time inputs show the browser's own format, so they get none. */
const PLACEHOLDER_RULES = [
  [/email/, "name@company.com"],
  [/whatsapp/, "+91 98765 43210"],
  [/phone|mobile|tel/, "+91 98765 43210"],
  [/pincode|postcode|postal|zip/, "e.g. B10 0AA"],
  [/website|url/, "https://www.example.com"],
  [/address/, "Street, city, state, postal code, country"],
  [/note|remark|comment/, "Add any extra notes here..."],
  [/description/, "Write a short description..."],
  [/reason/, "Reason for this entry"],
  [/source/, "e.g. Referral, website, event"],
  [/amount|price|total|receivable|credit|budget|limit/, "0.00"],
  [/quantity|qty/, "0"],
  [/company/, "Company / business name"],
  [/^name$|fullname|contactname|customer|payee/, "Enter full name"],
  [/location|storage/, "e.g. Main warehouse, Rack A1"],
  [/category/, "e.g. Dairy, Frozen, Packaging"],
  [/department/, "e.g. Sales, Production"],
  [/role|designation/, "e.g. Store manager"],
  [/supplier|vendor/, "Supplier / vendor name"],
  [/owner|assigned/, "Person or team responsible"],
  [/number|reference|code|sku|^ref$|id$/, "e.g. REF-1001"],
];
const placeholderFor = (field) => {
  if (field.placeholder) return field.placeholder;
  if (field.type === "date" || field.type === "time" || field.type === "select") return "";
  const key = String(field.key).toLowerCase();
  const match = PLACEHOLDER_RULES.find(([re]) => re.test(key));
  if (match) return match[1];
  if (field.type === "number") return "0";
  const label = String(field.label || field.key).replace(/\s*\*$/, "");
  return field.type === "textarea" ? `Write ${label.toLowerCase()} here...` : `Enter ${label.toLowerCase()}`;
};

/* Colour of a choice chip, chosen from its text (Paid -> green, Overdue -> red, Pending -> amber ...) */
const toneOf = (option) => {
  const t = String(option).toLowerCase();
  if (t === "whatsapp") return "green";
  if (t === "email") return "blue";
  if (t === "sms") return "amber";
  if (/overdue|cancel|declin|lost|reject|out of stock|low stock|inactive|urgent|high/.test(t)) return "red";
  if (/partial|pending|draft|new|process|hold|medium|not started|scheduled|on leave/.test(t)) return "amber";
  if (/sent|ordered|shipped|contacted|qualified|confirmed|progress/.test(t)) return "blue";
  if (/paid|active|complet|approv|accept|receiv|deliver|^low$/.test(t)) return "green";
  return "neutral";
};

/* "" when the value is fine (or empty), otherwise a short message */
const invalidMsg = (field, value) => {
  const v = String(value ?? "").trim();
  if (!v) return "";
  if (field.type === "email" && !/^\S+@\S+\.\S+$/.test(v)) return "Enter a valid email address";
  if (field.type === "url") { try { new URL(v); } catch { return "Enter a full link, e.g. https://example.com"; } }
  if (field.type === "tel" && v.replace(/\D/g, "").length < 7) return "Enter a valid phone number";
  if (field.type === "multi") {
    const bad = multiItems(v).some((n) => n && n.replace(/\D/g, "").length < 7);
    if (bad) return "Enter a valid phone number in every row";
  }
  return "";
};

export default function ErpFormModal({
  eyebrow = "ERP", title, subtitle = "Fields marked * are required.", icon = "fa-file-circle-plus",
  fields, form, setForm, saving = false, error = "", submitLabel = "Save", onSubmit, onClose,
}) {
  const [closing, setClosing] = useState(false);
  const [touched, setTouched] = useState({});
  const [activeSec, setActiveSec] = useState(0);
  const [dark] = useState(() => typeof document !== "undefined" && !!document.querySelector(".app.dark"));
  const bodyRef = useRef(null);
  const timerRef = useRef(null);

  const requestClose = () => {
    if (saving || closing) return;
    setClosing(true);
    timerRef.current = setTimeout(onClose, 170);   // let the exit animation play first
  };
  const closeRef = useRef(requestClose);
  closeRef.current = requestClose;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event) => { if (event.key === "Escape") closeRef.current(); };
    window.addEventListener("keydown", onKey);
    const focusTimer = setTimeout(() => {
      bodyRef.current?.querySelector("input:not([type=hidden]):not(.erp-fm-hidden), textarea, select")?.focus({ preventScroll: true });
    }, 300);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
      clearTimeout(focusTimer);
      clearTimeout(timerRef.current);
    };
  }, []);

  const setValue = (key, value) => setForm((old) => ({ ...old, [key]: value }));
  const markTouched = (key) => setTouched((old) => (old[key] ? old : { ...old, [key]: true }));

  /* group consecutive fields that share a `section` */
  const groups = useMemo(() => {
    const out = [];
    fields.forEach((field) => {
      const title = field.section || "";
      const last = out[out.length - 1];
      if (last && last.title === title) last.fields.push(field);
      else out.push({ title, fields: [field] });
    });
    return out;
  }, [fields]);
  const showRail = groups.filter((g) => g.title).length >= 2;

  /* progress numbers */
  const total = fields.length;
  const done = fields.filter((f) => filled(form[f.key])).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const requiredLeft = fields.filter((f) => f.required && !filled(form[f.key])).length;

  const sectionState = (group) => {
    const req = group.fields.filter((f) => f.required);
    const some = group.fields.some((f) => filled(form[f.key]));
    const complete = req.length ? req.every((f) => filled(form[f.key])) : some;
    return { complete, count: group.fields.filter((f) => filled(form[f.key])).length };
  };

  const onBodyScroll = () => {
    const el = bodyRef.current;
    if (!el || !showRail) return;
    const top = el.scrollTop + 70;
    let current = 0;
    el.querySelectorAll("[data-sec]").forEach((node, i) => { if (node.offsetTop <= top) current = i; });
    setActiveSec(current);
  };
  const jumpTo = (i) => {
    const el = bodyRef.current;
    const node = el?.querySelector(`[data-sec="${i}"]`);
    if (!el || !node) return;
    el.scrollTo({ top: Math.max(0, node.offsetTop - 8), behavior: "smooth" });
    setActiveSec(i);
  };

  const renderControl = (field) => {
    const id = `erp-fm-${field.key}`;
    const value = form[field.key] ?? "";
    const options = field.options || [];
    const common = { id, name: field.key, value, required: field.required, onChange: (e) => setValue(field.key, e.target.value), onBlur: () => markTouched(field.key) };
    const placeholder = placeholderFor(field);

    if (field.type === "textarea") {
      return <div className="erp-fm-control is-area">
        <textarea rows="3" maxLength={500} placeholder={placeholder} {...common} />
        <span className="erp-fm-count">{String(value).length}/500</span>
      </div>;
    }

    /* several numbers: one input per number, "+ Add number" adds a row */
    if (field.type === "multi") {
      const items = multiItems(value);
      const inputIcon = iconFor(field);
      const message = touched[field.key] ? invalidMsg(field, value) : "";
      const setItems = (list) => setValue(field.key, list.join(", "));
      return <>
        <div className="erp-fm-multi">
          {items.map((num, idx) => (
            <div className="erp-fm-multi-row" key={idx}>
              <div className={`erp-fm-control${inputIcon ? " has-icon" : ""}${message ? " is-invalid" : ""}`}>
                {inputIcon && <i className={`${inputIcon.cls} erp-fm-icon${inputIcon.tone ? ` tone-${inputIcon.tone}` : ""}`} aria-hidden="true" />}
                <input
                  type="tel"
                  id={idx === 0 ? id : `${id}-${idx}`}
                  name={idx === 0 ? field.key : `${field.key}-${idx}`}
                  placeholder={placeholder}
                  value={num}
                  onChange={(e) => setItems(items.map((n, k) => (k === idx ? e.target.value.replace(/,/g, "") : n)))}
                  onBlur={() => markTouched(field.key)}
                />
              </div>
              {items.length > 1 && (
                <button type="button" className="erp-fm-multi-del" title="Remove this number" aria-label={`Remove number ${idx + 1}`}
                  onClick={() => setItems(items.filter((_, k) => k !== idx))}>
                  <i className="fa-solid fa-xmark" aria-hidden="true" />
                </button>
              )}
            </div>
          ))}
          {items.length < MULTI_MAX && (
            <button type="button" className="erp-fm-add" onClick={() => setItems([...items, ""])}>
              <i className="fa-solid fa-plus" aria-hidden="true" /> Add number
            </button>
          )}
        </div>
        {message && <p className="erp-fm-hint-text" role="alert">{message}</p>}
      </>;
    }

    if (field.type === "select" && options.length > 0 && options.length <= 6) {
      return <div className="erp-fm-chips" role="radiogroup" aria-label={field.label}>
        {options.map((option) => {
          const on = value === option;
          const chipIcon = chipIconOf(option);
          return <button key={option} type="button" role="radio" aria-checked={on}
            className={`erp-fm-chip tone-${toneOf(option)}${on ? " is-on" : ""}${chipIcon ? " has-ico" : ""}`}
            onClick={() => setValue(field.key, option)}>
            {chipIcon
              ? <i className={`${chipIcon} erp-fm-chip-ico`} aria-hidden="true" />
              : on && <i className="fa-solid fa-check" aria-hidden="true" />}
            {option}
          </button>;
        })}
        {field.required && <input className="erp-fm-hidden" tabIndex={-1} aria-hidden="true" required value={value} onChange={() => {}} />}
      </div>;
    }

    if (field.type === "select") {
      return <div className="erp-fm-control is-select">
        <select {...common}>
          <option value="">Select {field.label}</option>
          {options.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
        <i className="fa-solid fa-chevron-down erp-fm-chevron" aria-hidden="true" />
      </div>;
    }

    const inputIcon = iconFor(field);
    const message = touched[field.key] ? invalidMsg(field, value) : "";
    const ok = filled(value) && !invalidMsg(field, value) && (field.required || ["email", "tel", "url"].includes(field.type));
    return <>
      <div className={`erp-fm-control${inputIcon ? " has-icon" : ""}${message || ok ? " has-state" : ""}${message ? " is-invalid" : ""}`}>
        {inputIcon && <i className={`${inputIcon.cls} erp-fm-icon${inputIcon.tone ? ` tone-${inputIcon.tone}` : ""}`} aria-hidden="true" />}
        <input type={field.type || "text"} min={field.min} step={field.type === "number" ? "0.01" : undefined} placeholder={placeholder} {...common} />
        {ok && !message && <i className="fa-solid fa-circle-check erp-fm-state is-ok" aria-hidden="true" />}
        {message && <i className="fa-solid fa-circle-exclamation erp-fm-state is-bad" aria-hidden="true" />}
      </div>
      {message && <p className="erp-fm-hint-text" role="alert">{message}</p>}
    </>;
  };

  let stagger = 0;
  let stepNumber = 0;

  return createPortal(
    <div
      className={`erp-fm-backdrop${dark ? " is-dark" : ""}${closing ? " is-closing" : ""}`}
      role="presentation"
      onMouseDown={(event) => { if (event.target === event.currentTarget) requestClose(); }}
    >
      <section className={`erp-fm${showRail ? " has-rail" : ""}`} role="dialog" aria-modal="true" aria-labelledby="erp-fm-title">
        <header className="erp-fm-head">
          <span className="erp-fm-badge"><i className={`fa-solid ${icon}`} aria-hidden="true" /></span>
          <div className="erp-fm-heading">
            <p className="erp-fm-eyebrow">{eyebrow}</p>
            <h2 id="erp-fm-title">{title}</h2>
            <p className="erp-fm-sub">{subtitle}</p>
          </div>
          <span className="erp-fm-pct" title="Fields filled">{pct}% complete</span>
          <button type="button" className="erp-fm-close" onClick={requestClose} disabled={saving} aria-label="Close"><i className="fa-solid fa-xmark" /></button>
          <div className="erp-fm-progress" aria-hidden="true"><span style={{ width: `${pct}%` }} /></div>
        </header>

        <div className="erp-fm-main">
          {showRail && <nav className="erp-fm-rail" aria-label="Form sections">
            <p className="erp-fm-rail-title">Sections</p>
            {groups.map((group, gi) => {
              if (!group.title) return null;
              stepNumber += 1;
              const state = sectionState(group);
              return <button key={gi} type="button" onClick={() => jumpTo(gi)} style={{ "--i": stepNumber }}
                className={`erp-fm-step${activeSec === gi ? " is-active" : ""}${state.complete ? " is-done" : ""}`}>
                <span className="erp-fm-step-dot">{state.complete ? <i className="fa-solid fa-check" aria-hidden="true" /> : stepNumber}</span>
                <span className="erp-fm-step-text"><span>{group.title}</span><small>{state.count} of {group.fields.length} filled</small></span>
              </button>;
            })}
          </nav>}

          <form
            className="erp-fm-form"
            onSubmit={onSubmit}
            onKeyDown={(event) => { if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) { event.preventDefault(); event.currentTarget.requestSubmit(); } }}
          >
            <div className="erp-fm-body" ref={bodyRef} onScroll={onBodyScroll}>
              {groups.map((group, gi) => {
                const secIcon = group.title ? sectionIcon(group.title) : null;
                return (
                  <div key={gi} className="erp-fm-group" data-sec={gi}>
                    {group.title && (
                      <h3 className="erp-fm-section">
                        <span>{secIcon && <i className={`${secIcon} erp-fm-section-ico`} aria-hidden="true" />}{group.title}</span>
                      </h3>
                    )}
                    <div className="erp-fm-grid">
                      {group.fields.map((field) => {
                        const i = stagger++;
                        return <div key={field.key} className={`erp-fm-field${field.wide ? " wide" : ""}`} style={{ "--i": Math.min(i, 14) }}>
                          <label htmlFor={`erp-fm-${field.key}`}>{field.label}{field.required && <b> *</b>}</label>
                          {renderControl(field)}
                        </div>;
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            {error && <div key={error} className="erp-fm-error" role="alert"><i className="fa-solid fa-circle-exclamation" aria-hidden="true" /> {error}</div>}

            <footer className="erp-fm-foot">
              <div className={`erp-fm-foot-note${requiredLeft === 0 ? " is-ok" : ""}`}>
                {requiredLeft > 0
                  ? <><i className="fa-solid fa-asterisk" aria-hidden="true" /> {requiredLeft} required field{requiredLeft === 1 ? "" : "s"} left</>
                  : <><i className="fa-solid fa-circle-check" aria-hidden="true" /> {fields.some((f) => f.required) ? "All required fields done" : "Ready to save"}</>}
                <span className="erp-fm-kbd">Ctrl + Enter to save</span>
              </div>
              <div className="erp-fm-actions">
                <button type="button" className="erp-fm-btn erp-fm-cancel" onClick={requestClose} disabled={saving}>Cancel</button>
                <button type="submit" className="erp-fm-btn erp-fm-primary" disabled={saving}>
                  <i className={`fa-solid ${saving ? "fa-spinner fa-spin" : "fa-floppy-disk"}`} aria-hidden="true" /> {saving ? "Saving…" : submitLabel}
                </button>
              </div>
            </footer>
          </form>
        </div>
      </section>
    </div>,
    document.body
  );
}