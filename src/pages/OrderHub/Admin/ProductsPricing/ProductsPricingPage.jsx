import { useRef, useState } from "react";
import PageHeader from "@/components/PageHeader/PageHeader.jsx";
import DataTable from "@/components/DataTable/DataTable.jsx";
import ProductImageInput from "@/components/ProductImageInput.jsx";
import { HubCard, Field, HubButton, HubNotice } from "@/components/HubUI/HubUI.jsx";
import { useHub, saveStandardPrice, saveOverride, addProduct, updateProduct, gbp } from "@/data/orderHubStore.js";
import "./ProductsPricingPage.css";

/* ---------- CSV helpers (no extra library needed) ---------- */
const CSV_HEADERS = ["Item code", "Description", "Category", "Cost price", "Standard price"];

const csvEscape = (v) => {
  const t = v === undefined || v === null ? "" : String(v);
  return /[",\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};

const downloadCsv = (filename, rows) => {
  const text = rows.map((r) => r.map(csvEscape).join(",")).join("\r\n");
  // BOM so Excel opens it with correct characters
  const blob = new Blob(["\uFEFF" + text], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/* parses CSV text into an array of rows (handles quotes, commas inside quotes, CRLF) */
const parseCsv = (input) => {
  const text = input.replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = false;
      } else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      rows.push(row); row = [];
    } else cell += ch;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => String(c).trim() !== ""));
};

/* header name -> field key */
const FIELD_MAP = {
  "item code": "code", code: "code", item: "code", sku: "code",
  description: "description", name: "description",
  category: "category",
  "cost price": "costPrice", cost: "costPrice", costprice: "costPrice",
  "standard price": "standardPrice", price: "standardPrice", standardprice: "standardPrice",
};
const normHeader = (h) => String(h || "").trim().toLowerCase().replace(/[_-]+/g, " ");
const toNumber = (v) => {
  const n = parseFloat(String(v ?? "").replace(/[^0-9.\-]/g, ""));
  return Number.isNaN(n) ? null : n;
};

function PriceCell({ product }) {
  const [val, setVal] = useState(String(product.standardPrice));
  return (
    <div className="hub-row">
      <input type="number" step="0.01" className="hub-input price" value={val} onChange={(e) => setVal(e.target.value)} />
      <HubButton size="sm" variant="ghost" onClick={() => { const n = parseFloat(val); if (!Number.isNaN(n)) saveStandardPrice(product.code, n); }}>Save</HubButton>
    </div>
  );
}

/* image of one product row: upload / change / remove (saved straight away) */
function ImageCell({ product, onResult }) {
  return (
    <ProductImageInput
      compact
      value={product.image || ""}
      onChange={async (img) => onResult(await updateProduct(product.code, { image: img }))}
    />
  );
}

const EMPTY = { code: "", description: "", category: "", costPrice: "", standardPrice: "", image: "" };

export default function ProductsPricingPage() {
  const s = useHub();
  const [ovClient, setOvClient] = useState(s.clients[0].id);
  const [ovCode, setOvCode] = useState(s.products[0]?.code || "");
  const [ovPrice, setOvPrice] = useState("");
  const [msg, setMsg] = useState("");

  /* add product */
  const [form, setForm] = useState(EMPTY);
  const [addMsg, setAddMsg] = useState(null); // { ok, text }
  const [busy, setBusy] = useState(false);
  const setF = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  /* import / export */
  const fileRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [ioMsg, setIoMsg] = useState(null); // { ok, text }

  const submitProduct = async () => {
    setBusy(true);
    const r = await addProduct({
      code: form.code,
      description: form.description,
      category: form.category,
      costPrice: form.costPrice,
      standardPrice: form.standardPrice,
      image: form.image,
    });
    setBusy(false);
    setAddMsg({ ok: r.ok, text: r.msg });
    if (r.ok) setForm(EMPTY);
  };

  /* ---------- EXPORT: all products -> CSV ---------- */
  const exportProducts = () => {
    if (!s.products.length) { setIoMsg({ ok: false, text: "No products to export." }); return; }
    const rows = [
      CSV_HEADERS,
      ...s.products.map((p) => [p.code, p.description, p.category, p.costPrice, p.standardPrice]),
    ];
    const date = new Date().toISOString().slice(0, 10);
    downloadCsv(`products-${date}.csv`, rows);
    setIoMsg({ ok: true, text: `Exported ${s.products.length} products.` });
  };

  /* ---------- TEMPLATE: empty CSV with headers + one sample row ---------- */
  const downloadTemplate = () => {
    downloadCsv("products-template.csv", [CSV_HEADERS, ["RC-003", "Basmati Rice 10kg", "Grocery", "9.50", "12.99"]]);
  };

  /* ---------- IMPORT: CSV -> add new products / update existing ones ---------- */
  const importProducts = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allows choosing the same file again
    if (!file) return;
    if (!/\.csv$/i.test(file.name)) { setIoMsg({ ok: false, text: "Please choose a .csv file." }); return; }

    setImporting(true);
    setIoMsg(null);
    try {
      const rows = parseCsv(await file.text());
      if (rows.length < 2) { setIoMsg({ ok: false, text: "The file has no data rows." }); return; }

      const keys = rows[0].map((h) => FIELD_MAP[normHeader(h)] || null);
      if (!keys.includes("code")) { setIoMsg({ ok: false, text: "Missing the 'Item code' column. Download the template to see the format." }); return; }

      let added = 0, updated = 0;
      const errors = [];

      for (let i = 1; i < rows.length; i++) {
        const rec = {};
        keys.forEach((k, idx) => { if (k) rec[k] = String(rows[i][idx] ?? "").trim(); });
        const line = i + 1;
        if (!rec.code) { errors.push(`Row ${line}: item code is empty`); continue; }

        const existing = s.products.find((p) => String(p.code).toLowerCase() === rec.code.toLowerCase());
        const cost = toNumber(rec.costPrice);
        const price = toNumber(rec.standardPrice);

        if (existing) {
          const changes = {};
          if (rec.description) changes.description = rec.description;
          if (rec.category) changes.category = rec.category;
          if (cost !== null) changes.costPrice = cost;
          if (Object.keys(changes).length) {
            const r = await updateProduct(existing.code, changes);
            if (r && r.ok === false) { errors.push(`Row ${line} (${rec.code}): ${r.msg || "could not update"}`); continue; }
          }
          if (price !== null) await saveStandardPrice(existing.code, price);
          updated++;
        } else {
          const r = await addProduct({
            code: rec.code,
            description: rec.description || "",
            category: rec.category || "",
            costPrice: rec.costPrice ?? "",
            standardPrice: rec.standardPrice ?? "",
            image: "",
          });
          if (r && r.ok === false) errors.push(`Row ${line} (${rec.code}): ${r.msg || "could not add"}`);
          else added++;
        }
      }

      const summary = `Import finished: ${added} added, ${updated} updated${errors.length ? `, ${errors.length} failed` : ""}.`;
      setIoMsg({
        ok: errors.length === 0,
        text: errors.length ? `${summary} ${errors.slice(0, 3).join(" | ")}${errors.length > 3 ? " ..." : ""}` : summary,
      });
    } catch (err) {
      setIoMsg({ ok: false, text: "Could not read the file. Please check the CSV format." });
    } finally {
      setImporting(false);
    }
  };

  const prodCols = [
    { key: "image", label: "Image", render: (p) => <ImageCell key={`${p.code}-${p.image ? "y" : "n"}`} product={p} onResult={(r) => setMsg(r.msg)} /> },
    { key: "code", label: "Item", sortable: true, render: (p) => <span className="hub-mono">{p.code}</span> },
    { key: "description", label: "Description", sortable: true },
    { key: "category", label: "Category", sortable: true },
    { key: "costPrice", label: "Cost", align: "right", sortable: true, render: (p) => gbp(p.costPrice) },
    { key: "standardPrice", label: "Standard Price", sortable: true, render: (p) => <PriceCell key={`${p.code}-${p.standardPrice}`} product={p} /> },
  ];
  const overrides = s.clients.flatMap((c) => Object.entries(c.priceOverrides).map(([code, price]) => ({ id: `${c.id}-${code}`, client: c.name, code, price })));
  const ovCols = [
    { key: "client", label: "Client", sortable: true },
    { key: "code", label: "Item", sortable: true, render: (r) => <span className="hub-mono">{r.code}</span> },
    { key: "price", label: "Override Price", align: "right", sortable: true, render: (r) => gbp(r.price) },
  ];
  const save = () => {
    const n = parseFloat(ovPrice);
    if (Number.isNaN(n)) { setMsg("Enter a price."); return; }
    saveOverride(ovClient, ovCode, n);
    setOvPrice(""); setMsg("Override saved.");
  };

  return (
    <div className="page-anim products-pricing-page">
      <PageHeader eyebrow="SALES & MARKETING" title="Products & Services" subtitle="Standard pricing plus any client-specific overrides." icon="fa-tags"
        actions={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <HubButton variant="ghost" icon="fa-file-arrow-down" onClick={downloadTemplate}>Template</HubButton>
            <HubButton variant="ghost" icon="fa-file-import" onClick={() => fileRef.current?.click()} disabled={importing}>{importing ? "Importing..." : "Import"}</HubButton>
            <HubButton icon="fa-file-export" onClick={exportProducts}>Export</HubButton>
            <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={importProducts} style={{ display: "none" }} />
          </div>
        } />

      {ioMsg && <HubNotice tone={ioMsg.ok ? "green" : "red"}>{ioMsg.text}</HubNotice>}

      <HubCard title="Add new product">
        <div className="hub-form">
          <Field label="Item code"><input type="text" value={form.code} onChange={setF("code")} placeholder="e.g. RC-003" /></Field>
          <Field label="Description"><input type="text" value={form.description} onChange={setF("description")} placeholder="e.g. Basmati Rice 10kg" /></Field>
          <Field label="Category"><input type="text" value={form.category} onChange={setF("category")} placeholder="e.g. Grocery" /></Field>
          <Field label="Cost price"><input type="number" step="0.01" value={form.costPrice} onChange={setF("costPrice")} /></Field>
          <Field label="Standard price"><input type="number" step="0.01" value={form.standardPrice} onChange={setF("standardPrice")} /></Field>
        </div>
        <div className="pp-image">
          <span className="pp-image-label">Product image</span>
          <ProductImageInput value={form.image} onChange={(img) => setForm((f) => ({ ...f, image: img }))} />
        </div>
        <div className="pp-save">
          <HubButton size="sm" icon="fa-plus" onClick={submitProduct} disabled={busy}>{busy ? "Adding..." : "Add product"}</HubButton>
        </div>
        <HubNotice tone={addMsg?.ok ? "green" : "red"}>{addMsg?.text}</HubNotice>
      </HubCard>

      <HubCard title="Standard price list"><DataTable columns={prodCols} rows={s.products.map((p) => ({ ...p, id: p.code }))} entity="products" searchPlaceholder="Search in Products" /></HubCard>

      <HubCard title="Client-specific price override">
        <div className="hub-form">
          <Field label="Client"><select value={ovClient} onChange={(e) => setOvClient(e.target.value)}>{s.clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>
          <Field label="Item"><select value={ovCode} onChange={(e) => setOvCode(e.target.value)}>{s.products.map((p) => <option key={p.code} value={p.code}>{p.code} - {p.description}</option>)}</select></Field>
          <Field label="Override price"><input type="number" step="0.01" value={ovPrice} onChange={(e) => setOvPrice(e.target.value)} /></Field>
        </div>
        <div className="pp-save"><HubButton size="sm" icon="fa-floppy-disk" onClick={save}>Save override</HubButton></div>
        <HubNotice>{msg}</HubNotice>
        <div className="hub-divider" />
        <DataTable columns={ovCols} rows={overrides} entity="overrides" searchPlaceholder="Search overrides" />
      </HubCard>
    </div>
  );
}