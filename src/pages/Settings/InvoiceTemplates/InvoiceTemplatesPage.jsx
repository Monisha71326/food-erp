import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader/PageHeader.jsx";
import { InvoiceDocument, InvoicePrintPortal, printInvoiceDocument } from "@/components/InvoicePrint/InvoicePrint.jsx";
import {
  TEMPLATES, ACCENT_PRESETS, GRADIENT_PRESETS,
  useInvoiceTemplate, saveInvoiceTemplate, resetInvoiceTemplate, accentCss, isHex,
} from "@/data/invoiceTemplateStore.js";
import "./InvoiceTemplatesPage.css";

const money = (n) => "£" + Number(n || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* Sample invoice used only for the previews. */
const SAMPLE = {
  number: "INV-1042", order: "SO-5021", customer: "Green Leaf Grocers",
  date: "24 Oct 2026", due: "25 Nov 2026", status: "Sent",
  lines: [
    { desc: "Whole Milk 1L (case of 12)", qty: 20, price: 14.5, total: 290 },
    { desc: "Greek Yoghurt 500g (tray of 8)", qty: 10, price: 9.2, total: 92 },
    { desc: "Cheddar Block 2kg", qty: 6, price: 18.75, total: 112.5 },
  ],
  net: 494.5, vat: 98.9, amount: 593.4, paid: 0, balance: 593.4,
  accountNo: "GRE001", cases: 36, carriage: 0, customerOrderNo: "",
  clientInfo: { contact: "", address: "24 Slade Lane, Manchester, M13 0QE" },
};

/* Colour picker + hex box (like a code editor's colour field) */
function ColorField({ label, value, onChange }) {
  const [text, setText] = useState(value);
  useEffect(() => { setText(value); }, [value]);

  const type = (v) => {
    setText(v);
    const hex = v.startsWith("#") ? v : `#${v}`;
    if (isHex(hex)) onChange(hex.toLowerCase());
  };

  return (
    <div className="itp-colorfield">
      <span className="itp-label">{label}</span>
      <div className="itp-colorrow">
        <input type="color" value={isHex(value) ? value : "#000000"} onChange={(e) => onChange(e.target.value)} aria-label={`${label} colour picker`} />
        <input className="itp-input itp-hex" value={text} onChange={(e) => type(e.target.value)} maxLength={7} spellCheck={false} aria-label={`${label} hex code`} placeholder="#a1122f" />
      </div>
    </div>
  );
}

export default function InvoiceTemplatesPage() {
  const saved = useInvoiceTemplate();
  const [draft, setDraft] = useState(saved);
  const [flash, setFlash] = useState("");

  const set = (key, value) => { setDraft((d) => ({ ...d, [key]: value })); setFlash(""); };

  /* colour changes go only to the currently selected template */
  const setColor = (patch) => {
    setDraft((d) => ({
      ...d,
      colors: { ...d.colors, [d.templateId]: { ...d.colors[d.templateId], ...patch } },
    }));
    setFlash("");
  };

  const cur = draft.colors[draft.templateId];
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const isGradient = cur.accentMode === "gradient";
  const { image: gradImage } = accentCss({ ...cur, accentMode: "gradient" });

  const save = () => {
    saveInvoiceTemplate(draft);
    setFlash("Saved. Invoices will now print with this template.");
  };
  const reset = () => {
    setDraft(resetInvoiceTemplate());
    setFlash("Reset to the default template.");
  };

  return (
    <div className="itp-page">
      <PageHeader
        eyebrow="SETTINGS"
        title="Invoice Templates"
        subtitle="Choose one of 4 templates and customise it. Saved changes apply to every printed invoice."
        icon="fa-file-invoice"
      />

      {flash && (
        <div className="itp-flash" role="status">
          <i className="fa-solid fa-circle-check" /> {flash}
          <button type="button" onClick={() => setFlash("")} aria-label="Dismiss">×</button>
        </div>
      )}

      {/* 1. Pick a template */}
      <section className="itp-card">
        <h4 className="itp-title"><i className="fa-solid fa-table-columns" /> 1. Choose a template</h4>
        <div className="itp-templates">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`itp-tpl${draft.templateId === t.id ? " sel" : ""}`}
              aria-pressed={draft.templateId === t.id}
              onClick={() => set("templateId", t.id)}
            >
              <span className="itp-thumb" aria-hidden="true">
                <InvoiceDocument tpl={{ ...draft, templateId: t.id }} data={SAMPLE} money={money} />
              </span>
              <b>{t.name}{saved.templateId === t.id && <em>In use</em>}</b>
              <small>{t.desc}</small>
            </button>
          ))}
        </div>
      </section>

      <div className="itp-grid">
        {/* 2. Customise */}
        <section className="itp-card">
          <h4 className="itp-title"><i className="fa-solid fa-sliders" /> 2. Customise</h4>

          <label className="itp-label" htmlFor="itp-company">Company name</label>
          <input id="itp-company" className="itp-input" value={draft.companyName} maxLength={60} onChange={(e) => set("companyName", e.target.value)} />

          <label className="itp-label" htmlFor="itp-address">Address (one line per row)</label>
          <textarea id="itp-address" className="itp-input" rows={3} value={draft.address} maxLength={200} onChange={(e) => set("address", e.target.value)} placeholder={"Unit 4, Example Park\nLondon AB1 2CD"} />

          <div className="itp-row">
            <div>
              <label className="itp-label" htmlFor="itp-vat">VAT number</label>
              <input id="itp-vat" className="itp-input" value={draft.vatNo} maxLength={30} onChange={(e) => set("vatNo", e.target.value)} placeholder="GB123456789" />
            </div>
            <div>
              <label className="itp-label" htmlFor="itp-doctitle">Document title</label>
              <input id="itp-doctitle" className="itp-input" value={draft.title} maxLength={24} onChange={(e) => set("title", e.target.value)} />
            </div>
          </div>

          <p className="itp-label">Bank details (printed on the Trade template)</p>
          <div className="itp-row">
            <div><input className="itp-input" value={draft.bankName || ""} maxLength={40} onChange={(e) => set("bankName", e.target.value)} placeholder="Bank (e.g. Natwest PLC)" aria-label="Bank" /></div>
            <div><input className="itp-input" value={draft.accountName || ""} maxLength={60} onChange={(e) => set("accountName", e.target.value)} placeholder="Account name" aria-label="Account name" /></div>
          </div>
          <div className="itp-row">
            <div><input className="itp-input" value={draft.accountNumber || ""} maxLength={20} onChange={(e) => set("accountNumber", e.target.value)} placeholder="Account number" aria-label="Account number" /></div>
            <div><input className="itp-input" value={draft.sortCode || ""} maxLength={10} onChange={(e) => set("sortCode", e.target.value)} placeholder="Sort code" aria-label="Sort code" /></div>
          </div>
          <input className="itp-input" value={draft.iban || ""} maxLength={34} onChange={(e) => set("iban", e.target.value)} placeholder="IBAN" aria-label="IBAN" />

          {/* Accent colour: Plain or Gradient (saved separately for each template) */}
          <p className="itp-label">Accent colour ({TEMPLATES.find((t) => t.id === draft.templateId)?.name} template)</p>
          <div className="itp-seg" role="tablist" aria-label="Colour type">
            <button type="button" role="tab" aria-selected={!isGradient} className={!isGradient ? "on" : ""} onClick={() => setColor({ accentMode: "plain" })}>
              <i className="fa-solid fa-droplet" /> Plain
            </button>
            <button type="button" role="tab" aria-selected={isGradient} className={isGradient ? "on" : ""} onClick={() => setColor({ accentMode: "gradient" })}>
              <i className="fa-solid fa-swatchbook" /> Gradient
            </button>
          </div>

          {!isGradient ? (
            <div className="itp-colorbox">
              <div className="itp-colors">
                {ACCENT_PRESETS.map((c) => (
                  <button
                    key={c} type="button" aria-label={`Use colour ${c}`} aria-pressed={cur.accent === c}
                    className={`itp-swatch${cur.accent === c ? " sel" : ""}`} style={{ background: c }}
                    onClick={() => setColor({ accent: c })}
                  />
                ))}
              </div>
              <ColorField label="Colour" value={cur.accent} onChange={(v) => setColor({ accent: v })} />
            </div>
          ) : (
            <div className="itp-colorbox">
              <div className="itp-gradbar" style={{ background: gradImage }} aria-hidden="true" />

              <div className="itp-presets">
                {GRADIENT_PRESETS.map((g) => {
                  const on = cur.gradFrom === g.from && cur.gradTo === g.to;
                  return (
                    <button
                      key={g.name} type="button" aria-pressed={on}
                      className={`itp-preset${on ? " sel" : ""}`}
                      onClick={() => setColor({ gradFrom: g.from, gradTo: g.to })}
                    >
                      <span style={{ background: `linear-gradient(90deg, ${g.from}, ${g.to})` }} />
                      {g.name}
                    </button>
                  );
                })}
              </div>

              <div className="itp-row">
                <ColorField label="From" value={cur.gradFrom} onChange={(v) => setColor({ gradFrom: v })} />
                <ColorField label="To" value={cur.gradTo} onChange={(v) => setColor({ gradTo: v })} />
              </div>

              <button type="button" className="itp-swap" onClick={() => setColor({ gradFrom: cur.gradTo, gradTo: cur.gradFrom })}>
                <i className="fa-solid fa-right-left" /> Swap colours
              </button>

              <div className="itp-angle">
                <span className="itp-label">Angle</span>
                <input
                  type="range" min="0" max="360" step="5" value={cur.gradAngle}
                  onChange={(e) => setColor({ gradAngle: Number(e.target.value) })} aria-label="Gradient angle"
                />
                <output>{cur.gradAngle}°</output>
              </div>
            </div>
          )}

          <label className="itp-label" htmlFor="itp-footer">Footer message</label>
          <input id="itp-footer" className="itp-input" value={draft.footerNote} maxLength={120} onChange={(e) => set("footerNote", e.target.value)} />

          <label className="itp-label" htmlFor="itp-terms">Terms &amp; notes (optional)</label>
          <textarea id="itp-terms" className="itp-input" rows={3} value={draft.terms} maxLength={400} onChange={(e) => set("terms", e.target.value)} placeholder="Payment due within 30 days. Bank: ... Sort code: ..." />

          <label className="itp-check">
            <input type="checkbox" checked={draft.showPaidStamp} onChange={(e) => set("showPaidStamp", e.target.checked)} />
            Show the green PAID stamp on paid invoices
          </label>

          <div className="itp-actions">
            <button type="button" className="itp-btn ghost" onClick={reset}>Reset to default</button>
            <button type="button" className="itp-btn ghost" onClick={printInvoiceDocument}><i className="fa-solid fa-print" /> Print test</button>
            <button type="button" className="itp-btn" onClick={save} disabled={!dirty}>
              <i className="fa-solid fa-floppy-disk" /> {dirty ? "Save template" : "Saved"}
            </button>
          </div>
        </section>

        {/* 3. Live preview */}
        <section className="itp-card itp-previewcard">
          <h4 className="itp-title"><i className="fa-solid fa-eye" /> 3. Live preview</h4>
          <div className="itp-preview">
            <InvoiceDocument tpl={draft} data={SAMPLE} money={money} />
          </div>
        </section>
      </div>

      {/* used by "Print test" */}
      <InvoicePrintPortal tpl={draft} data={SAMPLE} money={money} />
    </div>
  );
}