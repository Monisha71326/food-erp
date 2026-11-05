import { useMemo, useState } from "react";
import PageHeader from "@/components/PageHeader/PageHeader.jsx";
import DataTable from "@/components/DataTable/DataTable.jsx";
import SummaryStrip from "@/components/SummaryStrip/SummaryStrip.jsx";
import { HubCard, Field, HubButton, HubNotice, HubStatus } from "@/components/HubUI/HubUI.jsx";
import { useHub, client, product, gbp, createPromotion, updatePromotion, deletePromotion } from "@/data/orderHubStore.js";
import "./PromotionsPage.css";

/*
 * Promotions
 *   PRODUCTS : all products | selected products (one or many)
 *   CLIENTS  : all clients  | selected clients
 * Left = builder, right = live coupon preview.
 */

const PRESETS = [5, 10, 15, 20];
const initials = (name = "") => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

/* small "+N more" chip list used in the table */
function ChipList({ items, max = 2, tone = "gray", empty }) {
  if (!items.length) return empty || <span className="muted">-</span>;
  const shown = items.slice(0, max);
  const rest = items.slice(max);
  return (
    <div className="pr-chips">
      {shown.map((t) => <span key={t} className={`pr-chip ${tone}`}>{t}</span>)}
      {rest.length > 0 && <span className="pr-chip more" title={rest.join(", ")}>+{rest.length} more</span>}
    </div>
  );
}

/* two-option pill switch */
function Seg({ value, onChange, options }) {
  return (
    <div className="pr-seg" role="tablist">
      {options.map((o) => (
        <button key={o.value} type="button" role="tab" aria-selected={value === o.value}
          className={value === o.value ? "on" : ""} onClick={() => onChange(o.value)}>
          <i className={`fa-solid ${o.icon}`} aria-hidden="true" /> {o.label}
        </button>
      ))}
    </div>
  );
}

/* searchable tile picker (products or clients) */
function Picker({ items, selected, onToggle, onAll, onClear, placeholder, avatar }) {
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? items.filter((i) => `${i.label} ${i.sub || ""}`.toLowerCase().includes(t)) : items;
  }, [items, q]);
  return (
    <div className="pr-picker">
      <div className="pr-picker-bar">
        <label className="pr-search">
          <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
          <input type="text" value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} />
        </label>
        <span className="pr-count">{selected.length} of {items.length} selected</span>
        <button type="button" className="pr-link" onClick={onAll}>Select all</button>
        <button type="button" className="pr-link" onClick={onClear}>Clear</button>
      </div>
      <div className="pr-tiles">
        {list.map((i) => {
          const on = selected.includes(i.id);
          return (
            <button type="button" key={i.id} className={`pr-tile ${on ? "on" : ""}`} onClick={() => onToggle(i.id)} aria-pressed={on}>
              {avatar ? <span className="pr-avatar">{initials(i.label)}</span> : <span className="pr-prodicon"><i className="fa-solid fa-box" aria-hidden="true" /></span>}
              <span className="pr-tile-text">
                <b>{i.label}</b>
                {i.sub && <small>{i.sub}</small>}
              </span>
              <span className="pr-tick"><i className="fa-solid fa-check" aria-hidden="true" /></span>
            </button>
          );
        })}
        {!list.length && <p className="muted pr-none">Nothing matches "{q}".</p>}
      </div>
    </div>
  );
}

export default function PromotionsPage() {
  const s = useHub();
  const [code, setCode] = useState("");
  const [pct, setPct] = useState("");
  const [note, setNote] = useState("");
  const [productScope, setProductScope] = useState("all");
  const [clientScope, setClientScope] = useState("selected");
  const [ids, setIds] = useState([]);
  const [codes, setCodes] = useState([]);
  const [msg, setMsg] = useState(null);
  const [tableMsg, setTableMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const clientNames = (p) => (p.allClients ? [] : p.clientIds.map((id) => client(id)?.name).filter(Boolean));
  const productNames = (p) => (p.productCodes || []).map((c) => product(c)?.description || c);

  /* ---------- summary ---------- */
  const total = s.promotions.length;
  const active = s.promotions.filter((p) => p.active).length;
  const productWise = s.promotions.filter((p) => p.productCodes?.length).length;
  const everyone = s.promotions.filter((p) => p.allClients).length;

  /* ---------- table ---------- */
  const flip = async (p) => { const r = await updatePromotion(p.id, { active: !p.active }); setTableMsg({ ok: r.ok, text: r.msg }); };
  const remove = async (p) => { const r = await deletePromotion(p.id); if (r?.msg) setTableMsg({ ok: r.ok, text: r.msg }); };

  const columns = [
    { key: "code", label: "Code", sortable: true, render: (p) => <span className="pr-code"><i className="fa-solid fa-ticket" aria-hidden="true" />{p.code}</span> },
    { key: "discountPct", label: "Discount", sortable: true, render: (p) => <span className="pr-off">{p.discountPct}% <small>OFF</small></span> },
    { key: "products", label: "Products", sortable: true, sortValue: (p) => productNames(p).join(","),
      render: (p) => <ChipList items={productNames(p)} tone="blue" empty={<span className="pr-chip all"><i className="fa-solid fa-layer-group" aria-hidden="true" /> All products</span>} /> },
    { key: "clients", label: "Clients", sortable: true, sortValue: (p) => (p.allClients ? "All" : clientNames(p).join(",")),
      render: (p) => <ChipList items={clientNames(p)} tone="gray" empty={p.allClients ? <span className="pr-chip all"><i className="fa-solid fa-users" aria-hidden="true" /> All clients</span> : null} /> },
    { key: "status", label: "Status", render: (p) => <HubStatus status={p.active ? "Active" : "Inactive"} /> },
    { key: "actions", label: "", align: "right", render: (p) => (
      <div className="pr-actions">
        <button type="button" title={p.active ? "Pause promotion" : "Activate promotion"} onClick={() => flip(p)}>
          <i className={`fa-solid ${p.active ? "fa-pause" : "fa-play"}`} aria-hidden="true" />
        </button>
        <button type="button" className="del" title="Delete promotion" onClick={() => remove(p)}><i className="fa-regular fa-trash-can" aria-hidden="true" /></button>
      </div>
    ) },
  ];

  /* ---------- builder ---------- */
  const toggle = (setter) => (id) => setter((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const n = parseFloat(pct);
  const validPct = n > 0 && n <= 100;

  const create = async () => {
    if (!code.trim() || !validPct) { setMsg({ ok: false, text: "Enter a promo code and a discount between 1 and 100." }); return; }
    if (productScope === "selected" && !codes.length) { setMsg({ ok: false, text: "Pick at least one product, or choose All products." }); return; }
    if (clientScope === "selected" && !ids.length) { setMsg({ ok: false, text: "Pick at least one client, or choose All clients." }); return; }
    setBusy(true);
    const r = await createPromotion({
      code: code.trim().toUpperCase(), pct: n, note: note.trim(),
      allClients: clientScope === "all", clientIds: clientScope === "all" ? [] : ids,
      productCodes: productScope === "all" ? [] : codes,
    });
    setBusy(false);
    if (r.ok) { setCode(""); setPct(""); setNote(""); setIds([]); setCodes([]); setClientScope("selected"); setProductScope("all"); }
    setMsg({ ok: r.ok, text: r.ok ? "Promotion created - clients can see it in My Offers." : r.msg });
  };

  /* ---------- live preview ---------- */
  const sample = (productScope === "selected" && codes.length ? product(codes[0]) : null) || s.products[0];
  const off = validPct ? n : 0;
  const was = sample?.standardPrice || 0;
  const now = Math.round(was * (1 - off / 100) * 100) / 100;
  const prodLabel = productScope === "all" ? "All products" : codes.length ? `${codes.length} product${codes.length > 1 ? "s" : ""}` : "No product picked yet";
  const cliLabel = clientScope === "all" ? "All clients" : ids.length ? `${ids.length} client${ids.length > 1 ? "s" : ""}` : "No client picked yet";

  return (
    <div className="page-anim promotions-page">
      <PageHeader eyebrow="SALES & MARKETING" title="Promotions" subtitle="Run offers on all or selected products, for all or selected clients." icon="fa-percent" />

      <SummaryStrip columns={4} items={[
        { label: "Total promotions", value: total, icon: "fa-ticket", tone: "red" },
        { label: "Active now", value: active, icon: "fa-bolt", tone: "green" },
        { label: "Product-wise offers", value: productWise, icon: "fa-box-open", tone: "blue" },
        { label: "For all clients", value: everyone, icon: "fa-users", tone: "orange" },
      ]} />

      <HubCard title="All promotions" actions={tableMsg && <span className={`pr-flash ${tableMsg.ok ? "ok" : "bad"}`}>{tableMsg.text}</span>}>
        <DataTable columns={columns} rows={s.promotions} entity="promotions" searchPlaceholder="Search in Promotions" />
      </HubCard>

      <div className="pr-builder">
        <HubCard title="New promotion" className="pr-form">
          <div className="pr-step"><span className="pr-num">1</span><div><h4>Offer details</h4><p className="muted">Code and discount clients will see.</p></div></div>
          <div className="pr-details">
            <Field label="Promo code"><input type="text" value={code} maxLength={40} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s/g, ""))} placeholder="e.g. SUMMER15" /></Field>
            <Field label="Discount %"><input type="number" min="1" max="100" value={pct} onChange={(e) => setPct(e.target.value)} placeholder="10" /></Field>
            <div className="pr-presets">
              {PRESETS.map((v) => <button key={v} type="button" className={n === v ? "on" : ""} onClick={() => setPct(String(v))}>{v}%</button>)}
            </div>
            <Field label="Note (optional)" className="pr-note"><input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Rice clearance" /></Field>
          </div>

          <div className="pr-step"><span className="pr-num">2</span><div><h4>Which products?</h4><p className="muted">Pick one product, several, or leave it on all.</p></div></div>
          <Seg value={productScope} onChange={setProductScope} options={[
            { value: "all", label: "All products", icon: "fa-layer-group" },
            { value: "selected", label: "Selected products", icon: "fa-box" },
          ]} />
          {productScope === "selected" && (
            <Picker placeholder="Search products" items={s.products.map((p) => ({ id: p.code, label: p.description, sub: `${p.code} · ${gbp(p.standardPrice)}` }))}
              selected={codes} onToggle={toggle(setCodes)} onAll={() => setCodes(s.products.map((p) => p.code))} onClear={() => setCodes([])} />
          )}

          <div className="pr-step"><span className="pr-num">3</span><div><h4>Which clients?</h4><p className="muted">All clients includes accounts you add later.</p></div></div>
          <Seg value={clientScope} onChange={setClientScope} options={[
            { value: "all", label: "All clients", icon: "fa-users" },
            { value: "selected", label: "Selected clients", icon: "fa-user-check" },
          ]} />
          {clientScope === "selected" && (
            <Picker avatar placeholder="Search clients" items={s.clients.map((c) => ({ id: c.id, label: c.name, sub: c.contact }))}
              selected={ids} onToggle={toggle(setIds)} onAll={() => setIds(s.clients.map((c) => c.id))} onClear={() => setIds([])} />
          )}

          <div className="pr-submit">
            <HubButton icon="fa-plus" onClick={create} disabled={busy}>{busy ? "Creating..." : "Create promotion"}</HubButton>
            <HubNotice tone={msg?.ok ? "green" : "red"}>{msg?.text}</HubNotice>
          </div>
        </HubCard>

        <aside className="pr-preview">
          <p className="pr-preview-label"><i className="fa-solid fa-eye" aria-hidden="true" /> Live preview</p>
          <div className="pr-ticket">
            <div className="pr-ticket-top">
              <span className="pr-ticket-tag">PROMO CODE</span>
              <b className="pr-ticket-code">{code || "YOURCODE"}</b>
              <div className="pr-ticket-off">{off || 0}<span>% OFF</span></div>
            </div>
            <div className="pr-ticket-tear"><i /><i /></div>
            <div className="pr-ticket-body">
              <div className="pr-row"><span><i className="fa-solid fa-box" aria-hidden="true" /> Products</span><b>{prodLabel}</b></div>
              <div className="pr-row"><span><i className="fa-solid fa-users" aria-hidden="true" /> Clients</span><b>{cliLabel}</b></div>
              {sample && (
                <div className="pr-example">
                  <small>Example: {sample.description}</small>
                  <div><s>{gbp(was)}</s><i className="fa-solid fa-arrow-right" aria-hidden="true" /><b>{gbp(now)}</b></div>
                  {off > 0 && <em>Client saves {gbp(was - now)}</em>}
                </div>
              )}
            </div>
          </div>
          <ul className="pr-tips">
            <li>Discount applies only to the products you pick.</li>
            <li>Clients type the code on Place Order.</li>
            <li>Pause a promo any time from the table.</li>
          </ul>
        </aside>
      </div>
    </div>
  );
}