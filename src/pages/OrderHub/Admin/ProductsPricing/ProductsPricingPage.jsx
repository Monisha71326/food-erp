import { useState } from "react";
import PageHeader from "@/components/PageHeader/PageHeader.jsx";
import DataTable from "@/components/DataTable/DataTable.jsx";
import ProductImageInput from "@/components/ProductImageInput.jsx";
import { HubCard, Field, HubButton, HubNotice } from "@/components/HubUI/HubUI.jsx";
import { useHub, saveStandardPrice, saveOverride, addProduct, updateProduct, gbp } from "@/data/orderHubStore.js";
import "./ProductsPricingPage.css";

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
      <PageHeader eyebrow="SALES & MARKETING" title="Products & Pricing" subtitle="Standard pricing plus any client-specific overrides." icon="fa-tags"
        actions={<HubButton variant="ghost" icon="fa-file-arrow-up" onClick={() => setMsg("In the full build this opens a CSV / Excel template upload that bulk-updates standard prices.")}>Bulk upload template</HubButton>} />

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