import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HubNotice } from "@/components/HubUI/HubUI.jsx";
import { useHub, priceFor, placeOrder, client, gbp, promoForClient, promoCoversItem, haversineKm } from "@/data/orderHubStore.js";
import { useMyLocation } from "@/utils/useMyLocation.js";
import { confirmVisitType, AT_STORE_KM } from "@/utils/confirmVisitType.js";
import "./OrderForm.css";

/* PRODUCT IMAGES
   Put one image per product in the Vite "public/products" folder, named after the product code:
     public/products/<CODE>.jpg      e.g.  public/products/RICE-20.jpg
   Supported: jpg, jpeg, png, webp (tried in this order).
   Or give a product an `image` / `img` / `imageUrl` field with any URL.
   If no image is found, a coloured tile with the product's initials is shown instead. */
const EXTS = ["jpg", "jpeg", "png", "webp"];

const MAX_QTY = 9999;
const MAX_REMARK = 250;
const toQty = (v) => Math.min(MAX_QTY, Math.max(0, parseInt(v, 10) || 0));
const initials = (t) =>
  String(t || "?").replace(/[^A-Za-z0-9 ]/g, "").trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";
const tone = (code) => String(code || "").split("").reduce((a, ch) => a + ch.charCodeAt(0), 0) % 6;
const fmtKm = (km) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`);

/* product photo: tries several extensions, shimmer while loading, fade-in, fallback tile */
function ProductImg({ p, className = "" }) {
  const custom = p.image || p.img || p.imageUrl;
  const sources = custom ? [custom] : EXTS.map((e) => `/products/${p.code}.${e}`);
  const [idx, setIdx] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef(null);
  const label = p.description || p.code;

  /* image already cached / loaded before React attached onLoad */
  useEffect(() => {
    const el = imgRef.current;
    if (el && el.complete && el.naturalWidth > 0) setLoaded(true);
  }, [idx]);

  if (idx >= sources.length) {
    return (
      <span className={`oform-img oform-fallback t${tone(p.code)} ${className}`} role="img" aria-label={label}>
        <b>{initials(label)}</b>
      </span>
    );
  }
  return (
    <span className={`oform-imgwrap${loaded ? " is-loaded" : ""} ${className}`}>
      <img
        ref={imgRef}
        key={sources[idx]} className="oform-img" src={sources[idx]} alt={label}
        onLoad={() => setLoaded(true)} onError={() => setIdx((i) => i + 1)}
      />
    </span>
  );
}

/* - [ n ] + stepper */
function Stepper({ value, onChange, label, min = 0 }) {
  return (
    <div className="oform-stepper">
      <button type="button" aria-label={`Decrease quantity of ${label}`} disabled={value <= min} onClick={() => onChange(value - 1)}>
        <i className="fa-solid fa-minus" />
      </button>
      <input
        type="number" min={min} max={MAX_QTY} inputMode="numeric" aria-label={`Quantity of ${label}`}
        value={value} onFocus={(e) => e.target.select()}
        onChange={(e) => onChange(Math.max(min, toQty(e.target.value)))}
      />
      <button type="button" aria-label={`Increase quantity of ${label}`} disabled={value >= MAX_QTY} onClick={() => onChange(value + 1)}>
        <i className="fa-solid fa-plus" />
      </button>
    </div>
  );
}

/* one remark textarea (used on the cart page and in the product popup) */
function RemarkBox({ id, className, icon, label, value, onChange, rows = 3, placeholder }) {
  return (
    <div className={className}>
      <label htmlFor={id}>
        <i className={`fa-solid ${icon}`} /> {label} <em>(optional)</em>
      </label>
      <textarea
        id={id}
        rows={rows}
        maxLength={MAX_REMARK}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
      <small>{value.length}/{MAX_REMARK}</small>
    </div>
  );
}

/*
 * E-commerce style order form with TWO views:
 *   "shop" : catalogue (Grid / List). Each card has its OWN quantity box + "Add to cart" button.
 *            The product details popup also has an optional Remark box.
 *   "cart" : separate cart page - all items, promo code, remark(s), order summary, total, Place order
 *
 * REMARKS
 *   - Client portal order (placedBy = "Client portal")      -> ONE box: Client remark
 *   - Area manager order  (placedBy = "Area manager: ...")  -> TWO boxes: Client remark + Area manager remark
 *   The product popup box edits the "own" remark (client remark for a client, area manager remark for a manager).
 *
 * ONSITE / OFFSITE (area manager orders only)
 *   When the manager presses "Place order", the live location is compared with the client store.
 *   Within 300 m -> saved as ONSITE (no popup).
 *   Otherwise a confirm alert asks "place as OFFSITE order?" - Cancel = order is NOT saved.
 *
 * Used by "Place Order" (client) and "Place Order for Client" (area manager).
 *   clientId   : whose prices / credit limit / promos are used
 *   placedBy   : text saved on the order
 *   showPromo  : client portal shows the promo-code box on the cart page
 *   children   : optional controls above the catalogue (e.g. the client picker)
 */
export default function OrderForm({ clientId, placedBy, showPromo = false, children }) {
  const s = useHub();
  const c = client(clientId);
  const topRef = useRef(null);
  const isManager = /^area manager/i.test(String(placedBy || ""));
  const loc = useMyLocation(isManager); // live location (area managers only)
  const [step, setStep] = useState("shop"); // shop | cart
  const [qty, setQty] = useState({});
  const [draft, setDraft] = useState({});
  const [promo, setPromo] = useState("");
  const [promoOn, setPromoOn] = useState(false);
  const [clientRemark, setClientRemark] = useState("");   // what the client asked / noted
  const [managerRemark, setManagerRemark] = useState(""); // area manager's own note (managers only)
  const [msg, setMsg] = useState(null);
  const [placed, setPlaced] = useState(null);
  const [search, setSearch] = useState("");
  const [onlyBasket, setOnlyBasket] = useState(false);
  const [view, setView] = useState("grid");
  const [busy, setBusy] = useState(false);
  const [category, setCategory] = useState("All");
  const [sort, setSort] = useState("default");

  /* product detail popup */
  const [modal, setModal] = useState(null);
  const [mQty, setMQty] = useState(1);
  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);

  /* the remark the popup box edits = the placer's own remark */
  const ownRemark = isManager ? managerRemark : clientRemark;
  const setOwnRemark = isManager ? setManagerRemark : setClientRemark;

  /* live onsite / offsite hint for the cart page (managers only) */
  const kmToStore =
    isManager && loc.pos && c?.lat != null && c?.lng != null
      ? haversineKm(loc.pos.lat, loc.pos.lng, c.lat, c.lng)
      : null;
  const visitHint = !isManager ? null
    : kmToStore == null ? { on: false, text: "Location not available - this will be an OFFSITE order." }
    : kmToStore <= AT_STORE_KM ? { on: true, text: "You are at the store - ONSITE order." }
    : { on: false, text: `You are ${fmtKm(kmToStore)} away - OFFSITE order.` };

  const setQuantity = (code, value) => setQty((q) => ({ ...q, [code]: toQty(value) }));
  const goStep = (to) => {
    setStep(to);
    setMsg(null);
    setTimeout(() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 30);
  };

  const draftOf = (code) => draft[code] ?? (qty[code] > 0 ? qty[code] : 1);
  const setDraftQty = (code, v) => setDraft((d) => ({ ...d, [code]: Math.max(1, toQty(v)) }));

  const rows = s.products.map((p) => ({ ...p, id: p.code, unitPrice: priceFor(clientId, p.code) }));
  const lines = rows.filter((p) => (qty[p.code] || 0) > 0).map((p) => ({ ...p, n: qty[p.code], lineTotal: qty[p.code] * p.unitPrice }));
  const itemCount = lines.reduce((t, l) => t + l.n, 0);
  const subtotal = lines.reduce((t, l) => t + l.lineTotal, 0);

  const term = search.trim().toLowerCase();
  const categories = [...new Set(rows.map((p) => p.category || "General"))].sort();
  const catCount = (cat) => rows.filter((p) => (p.category || "General") === cat).length;

  const shown = rows
    .filter((p) => {
      if (onlyBasket && !(qty[p.code] > 0)) return false;
      if (category !== "All" && (p.category || "General") !== category) return false;
      if (!term) return true;
      return [p.code, p.description, p.category].some((v) => String(v || "").toLowerCase().includes(term));
    })
    .sort((a, b) => {
      if (sort === "name") return String(a.description || a.code).localeCompare(String(b.description || b.code));
      if (sort === "low") return a.unitPrice - b.unitPrice;
      if (sort === "high") return b.unitPrice - a.unitPrice;
      return 0;
    });
  const filtersOn = category !== "All" || sort !== "default" || onlyBasket || !!term;
  const clearFilters = () => { setCategory("All"); setSort("default"); setOnlyBasket(false); setSearch(""); };

  /* ---------- promo (cart page only) ---------- */
  const findPromo = (code) =>
    code.trim()
      ? s.promotions.find((x) => x.code === code.trim().toUpperCase() && x.active && promoForClient(x, clientId))
      : null;
  const scopeText = (pr) => (pr.productCodes?.length ? "selected products" : "all products");

  const pr = showPromo ? findPromo(promo) : null;
  const applied = promoOn && !!pr;
  const covers = (l) => applied && promoCoversItem(pr, l.code);
  const discount = applied ? lines.reduce((t, l) => t + (covers(l) ? l.lineTotal * pr.discountPct / 100 : 0), 0) : 0;
  const promoNote = !showPromo || !promo.trim() ? null
    : !pr ? { ok: false, text: "Promo code not valid on this account." }
    : !applied ? { ok: true, text: `Valid code: ${pr.discountPct}% off ${scopeText(pr)}. Press Apply.` }
    : discount > 0 ? { ok: true, text: `${pr.code} applied: ${pr.discountPct}% off ${scopeText(pr)}.` }
    : { ok: false, text: `${pr.code} applies only to ${pr.productCodes.join(", ")} - add one of them to the cart.` };
  const total = Math.max(0, subtotal - discount);

  const onPromoChange = (v) => { setPromo(v); setPromoOn(false); setMsg(null); };
  const applyPromo = () => { if (pr) setPromoOn(true); };
  const removePromo = () => { setPromo(""); setPromoOn(false); };

  /* ---------- toast ---------- */
  const showToast = (text) => {
    setToast(text);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 3600);
  };

  /* ---------- quick add straight from a catalogue card ---------- */
  const quickAdd = (p) => {
    const n = draftOf(p.code);
    if (n < 1) return;
    const had = (qty[p.code] || 0) > 0;
    setQuantity(p.code, n);
    setDraft((d) => { const { [p.code]: _drop, ...rest } = d; return rest; });
    setMsg(null);
    showToast(`${n} x ${p.description || p.code} ${had ? "updated in" : "added to"} your cart`);
  };

  /* ---------- product detail popup ---------- */
  const mProduct = modal ? rows.find((p) => p.code === modal) : null;
  const mTotal = mProduct ? mQty * mProduct.unitPrice : 0;

  const openModal = (p) => {
    setModal(p.code);
    setMQty(draftOf(p.code));
  };
  const closeModal = () => setModal(null);
  const confirmModal = () => {
    if (!mProduct || mQty < 1) return;
    const had = (qty[mProduct.code] || 0) > 0;
    setQuantity(mProduct.code, mQty);
    setDraft((d) => { const { [mProduct.code]: _drop, ...rest } = d; return rest; });
    closeModal();
    setMsg(null);
    showToast(`${mProduct.description || mProduct.code} ${had ? "updated in" : "added to"} your cart`);
  };

  useEffect(() => {
    if (!modal) return undefined;
    const onKey = (e) => { if (e.key === "Escape") setModal(null); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [modal]);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const submit = async () => {
    const payload = rows.map((p) => ({ code: p.code, qty: qty[p.code] || 0 }));
    const code = applied && discount > 0 ? pr.code : "";

    /* area manager: confirm ONSITE / OFFSITE before saving */
    let visit = { visitType: "", visitDistanceKm: null };
    if (isManager) {
      const v = confirmVisitType(loc.pos, c, gbp(total));
      if (!v) return; // manager pressed Cancel -> order is NOT placed
      visit = v;
    }

    setBusy(true);
    const r = await placeOrder({
      clientId,
      lines: payload,
      promoCode: showPromo ? code : "",
      placedBy,
      clientRemark: clientRemark.trim(),
      managerRemark: isManager ? managerRemark.trim() : "",
      visitType: visit.visitType,
      visitDistanceKm: visit.visitDistanceKm,
    });
    setBusy(false);
    if (r.ok) {
      setQty({}); setDraft({}); setPromo(""); setPromoOn(false);
      setClientRemark(""); setManagerRemark(""); setMsg(null);
      setPlaced(r.msg + (visit.visitType ? ` (${visit.visitType.toUpperCase()})` : ""));
    } else {
      setMsg({ ok: false, text: r.msg });
    }
  };

  const example = c?.promoIds?.length ? s.promotions.find((p) => p.id === c.promoIds[0])?.code : null;

  return (
    <section className="oform" ref={topRef}>
      {/* =====================================================
          CART PAGE
          ===================================================== */}
      {step === "cart" ? (
        <div className="ocart">
          <div className="ocart-head">
            <button type="button" className="ocart-back" onClick={() => { setPlaced(null); goStep("shop"); }}>
              <i className="fa-solid fa-arrow-left" /> Continue shopping
            </button>
            <div className="ocart-title">
              <h3><i className="fa-solid fa-cart-shopping" /> Your cart</h3>
              <span>
                {lines.length} product{lines.length === 1 ? "" : "s"} - {itemCount} item{itemCount === 1 ? "" : "s"}
                {c ? ` - for ${c.name}` : ""}
              </span>
            </div>
            {lines.length > 0 && (
              <button type="button" className="ocart-clear" onClick={() => { setQty({}); setDraft({}); setMsg(null); }}>
                <i className="fa-solid fa-trash-can" /> Clear cart
              </button>
            )}
          </div>

          {placed ? (
            /* ----- order placed ----- */
            <div className="ocart-done">
              <span className="ocart-done-ring"><i className="fa-solid fa-check" /></span>
              <h3>Order placed</h3>
              <p>{placed}</p>
              <button type="button" className="ocart-btn" onClick={() => { setPlaced(null); goStep("shop"); }}>
                <i className="fa-solid fa-cart-plus" /> Place another order
              </button>
            </div>
          ) : lines.length === 0 ? (
            /* ----- empty ----- */
            <div className="ocart-empty">
              <i className="fa-solid fa-cart-plus" />
              <h4>Your cart is empty</h4>
              <p>Choose products from the catalogue and tap <b>Add to cart</b>.</p>
              <button type="button" className="ocart-btn" onClick={() => goStep("shop")}>
                <i className="fa-solid fa-store" /> Browse products
              </button>
            </div>
          ) : (
            <div className="ocart-grid">
              {/* ----- items ----- */}
              <div className="ocart-items">
                <div className="ocart-items-head">
                  <span /><span>Product</span><span>Quantity</span><span>Total</span><span />
                </div>
                <ul>
                  {lines.map((l, i) => (
                    <li key={l.code} className="ocart-row" style={{ "--i": Math.min(i, 14) }}>
                      <ProductImg p={l} className="ocart-img" />
                      <div className="ocart-info">
                        <b title={l.description || l.code}>{l.description || l.code}</b>
                        <small className="hub-mono">{l.code}{l.category ? ` - ${l.category}` : ""}</small>
                        <small>{gbp(l.unitPrice)} each{covers(l) ? <em className="ocart-promo-tag"><i className="fa-solid fa-tag" /> {pr.discountPct}% off</em> : null}</small>
                      </div>
                      <div className="ocart-qty">
                        <Stepper value={l.n} min={1} label={l.description || l.code} onChange={(v) => setQuantity(l.code, v)} />
                      </div>
                      <span className="ocart-line" data-label="Total">{gbp(l.lineTotal)}</span>
                      <button type="button" className="ocart-remove" aria-label={`Remove ${l.description || l.code}`} onClick={() => setQuantity(l.code, 0)}>
                        <i className="fa-solid fa-xmark" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              {/* ----- promo + summary + total ----- */}
              <aside className="ocart-summary">
                <span className="ocart-eyebrow"><i className="fa-solid fa-receipt" /> Order summary</span>

                {showPromo && (
                  <div className="oform-promo">
                    <label htmlFor="ocart-promo">Promo code</label>
                    <div className="oform-promo-row">
                      <input
                        id="ocart-promo" type="text" value={promo} disabled={applied}
                        onChange={(e) => onPromoChange(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyPromo(); } }}
                        placeholder={example ? `e.g. ${example}` : "Enter code"}
                      />
                      {applied ? (
                        <button type="button" className="ocart-apply remove" onClick={removePromo}>Remove</button>
                      ) : (
                        <button type="button" className="ocart-apply" onClick={applyPromo} disabled={!pr}>Apply</button>
                      )}
                    </div>
                    {promoNote && <small className={promoNote.ok ? "ok" : "bad"}>{promoNote.text}</small>}
                  </div>
                )}

                <div className="oform-sum">
                  <div><span>Items</span><b>{itemCount}</b></div>
                  <div><span>Subtotal</span><b>{gbp(subtotal)}</b></div>
                  {discount > 0 && <div className="save"><span>Promo saving ({pr.code})</span><b>- {gbp(discount)}</b></div>}
                </div>

                <div className="ocart-total">
                  <span>Order total</span>
                  <div>
                    {discount > 0 && <s>{gbp(subtotal)}</s>}
                    <b key={total} className="bump">{gbp(total)}</b>
                  </div>
                </div>

                {/* ----- REMARKS (cart) ----- */}
                <RemarkBox
                  id="ocart-client-remark"
                  className="oform-remark"
                  icon="fa-comment-dots"
                  label="Client remark"
                  value={clientRemark}
                  onChange={setClientRemark}
                  placeholder={isManager ? "What the client asked for, delivery instructions..." : "Delivery instructions, special notes..."}
                />
                {isManager && (
                  <RemarkBox
                    id="ocart-manager-remark"
                    className="oform-remark"
                    icon="fa-user-tie"
                    label="Area manager remark"
                    value={managerRemark}
                    onChange={setManagerRemark}
                    placeholder="Your own note about this order..."
                  />
                )}

                {/* ----- live ONSITE / OFFSITE hint (area manager only) ----- */}
                {visitHint && (
                  <small className={visitHint.on ? "ok" : "bad"}>
                    <i className={`fa-solid ${visitHint.on ? "fa-location-crosshairs" : "fa-location-pin-lock"}`} /> {visitHint.text}
                  </small>
                )}

                <button type="button" className="oform-submit" onClick={submit} disabled={busy || lines.length === 0}>
                  <i className="fa-solid fa-paper-plane" /> {busy ? "Placing..." : "Place order"}
                </button>

                <HubNotice tone={msg?.ok ? "green" : "red"}>{msg?.text}</HubNotice>
              </aside>
            </div>
          )}
        </div>
      ) : (
        /* =====================================================
           SHOP PAGE
           ===================================================== */
        <>
          {children}

          <div className="oform-main">
            <div className="oform-toolbar">
              <div className="oform-title">
                <h3><i className="fa-solid fa-store" /> Catalogue</h3>
                <span>{shown.length} of {rows.length} products</span>
              </div>
              <label className="oform-search">
                <i className="fa-solid fa-magnifying-glass" />
                <input type="search" value={search} placeholder="Search by name or code" onChange={(e) => setSearch(e.target.value)} />
              </label>
              <div className="oform-chips" role="group" aria-label="Filter">
                <button type="button" className={`oform-chip${!onlyBasket ? " on" : ""}`} aria-pressed={!onlyBasket} onClick={() => setOnlyBasket(false)}>All items</button>
                <button type="button" className={`oform-chip${onlyBasket ? " on" : ""}`} aria-pressed={onlyBasket} onClick={() => setOnlyBasket(true)}>
                  In cart <b>{lines.length}</b>
                </button>
              </div>
              <div className="oform-views" role="group" aria-label="View">
                <button type="button" className={view === "grid" ? "on" : ""} aria-pressed={view === "grid"} onClick={() => setView("grid")} title="Grid view">
                  <i className="fa-solid fa-table-cells-large" /> <span>Grid</span>
                </button>
                <button type="button" className={view === "list" ? "on" : ""} aria-pressed={view === "list"} onClick={() => setView("list")} title="List view">
                  <i className="fa-solid fa-list" /> <span>List</span>
                </button>
              </div>
              <button type="button" className="oform-cartbtn" onClick={() => goStep("cart")} aria-label={`Open cart, ${itemCount} items`}>
                <i className="fa-solid fa-cart-shopping" /> <span>Cart</span> <b>{itemCount}</b>
              </button>
            </div>

            {/* ----- FILTER BAR ----- */}
            <div className="oform-filters">
              <div className="oform-cats" role="group" aria-label="Category">
                <button type="button" className={`oform-cat${category === "All" ? " on" : ""}`} aria-pressed={category === "All"} onClick={() => setCategory("All")}>
                  All <b>{rows.length}</b>
                </button>
                {categories.map((cat) => (
                  <button key={cat} type="button" className={`oform-cat${category === cat ? " on" : ""}`} aria-pressed={category === cat} onClick={() => setCategory(cat)}>
                    {cat} <b>{catCount(cat)}</b>
                  </button>
                ))}
              </div>
              <div className="oform-filter-right">
                <label className="oform-sort">
                  <i className="fa-solid fa-arrow-down-wide-short" />
                  <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort products">
                    <option value="default">Sort: Default</option>
                    <option value="name">Name A - Z</option>
                    <option value="low">Price: Low to High</option>
                    <option value="high">Price: High to Low</option>
                  </select>
                </label>
                {filtersOn && (
                  <button type="button" className="oform-clearf" onClick={clearFilters}>
                    <i className="fa-solid fa-filter-circle-xmark" /> Clear filters
                  </button>
                )}
              </div>
            </div>

            {shown.length === 0 ? (
              <div className="oform-empty">
                <i className="fa-solid fa-box-open" />
                <p>{onlyBasket && !term && category === "All" ? "Your cart is empty. Add items from All items." : "No products match your filters."}</p>
                {filtersOn && <button type="button" className="oform-clearf" onClick={clearFilters}>Clear filters</button>}
              </div>
            ) : view === "grid" ? (
              /* ----- GRID VIEW ----- */
              <ul className="oform-cards">
                {shown.map((p, i) => {
                  const n = qty[p.code] || 0;
                  const d = draftOf(p.code);
                  return (
                    <li key={p.code} className={`oform-card${n > 0 ? " on" : ""}`} style={{ "--i": Math.min(i, 14) }}>
                      <button type="button" className="oform-card-media" onClick={() => openModal(p)} aria-label={`View details of ${p.description || p.code}`}>
                        <ProductImg p={p} />
                        {n > 0 && <span key={n} className="oform-qty-badge"><i className="fa-solid fa-cart-shopping" /> {n}</span>}
                      </button>
                      <div className="oform-card-body">
                        <button type="button" className="oform-card-name oform-linkbtn" title={`View details of ${p.description || p.code}`} onClick={() => openModal(p)}>
                          {p.description || p.code}
                        </button>
                        <small className="hub-mono">{p.code}{p.category ? ` - ${p.category}` : ""}</small>
                      </div>
                      <div className="oform-card-price">
                        <span>{showPromo ? "Your price" : "Client price"}</span>
                        <strong>{gbp(p.unitPrice)}</strong>
                      </div>

                      <div className="oform-quick">
                        <Stepper value={d} min={1} label={p.description || p.code} onChange={(v) => setDraftQty(p.code, v)} />
                        <button type="button" className="oform-add" onClick={() => quickAdd(p)}>
                          <i className={`fa-solid ${n > 0 ? "fa-rotate" : "fa-cart-plus"}`} /> {n > 0 ? `Update cart (${n})` : `Add ${d > 1 ? `${d} ` : ""}to cart`}
                        </button>
                        <button type="button" className="oform-viewlink" onClick={() => openModal(p)}>
                          <i className="fa-regular fa-eye" /> View details
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              /* ----- LIST VIEW ----- */
              <div className="oform-list">
                <div className="oform-list-head">
                  <span /><span>Product</span><span>Price</span><span>Quantity</span><span>Total</span>
                </div>
                <ul>
                  {shown.map((p, i) => {
                    const n = qty[p.code] || 0;
                    return (
                      <li key={p.code} className={`oform-row${n > 0 ? " on" : ""}`} style={{ "--i": Math.min(i, 14) }}>
                        <ProductImg p={p} className="oform-row-img" />
                        <div className="oform-row-info">
                          <button type="button" className="oform-linkbtn oform-row-name" title={`View details of ${p.description || p.code}`} onClick={() => openModal(p)}>
                            {p.description || p.code}
                          </button>
                          <small className="hub-mono">{p.code}{p.category ? ` - ${p.category}` : ""}</small>
                        </div>
                        <span className="oform-row-price" data-label="Price">{gbp(p.unitPrice)}</span>
                        <div className="oform-row-qty"><Stepper value={n} label={p.description || p.code} onChange={(v) => setQuantity(p.code, v)} /></div>
                        <span className="oform-row-total" data-label="Total">{n > 0 ? gbp(n * p.unitPrice) : "-"}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>

          {/* ----- bottom cart bar ----- */}
          {lines.length > 0 && (
            <div className="oform-bar" role="region" aria-label="Cart summary">
              <div className="oform-bar-info">
                <span className="oform-bar-ico"><i className="fa-solid fa-cart-shopping" /></span>
                <div>
                  <b>{itemCount} item{itemCount === 1 ? "" : "s"}</b>
                  <small>{lines.length} product{lines.length === 1 ? "" : "s"}</small>
                </div>
              </div>
              <div className="oform-bar-total">
                <small>Subtotal</small>
                <strong>{gbp(subtotal)}</strong>
              </div>
              <button type="button" className="oform-bar-btn" onClick={() => goStep("cart")}>
                View cart <i className="fa-solid fa-arrow-right" />
              </button>
            </div>
          )}
        </>
      )}

      {/* ---------- Product detail popup (with remark) ---------- */}
      {mProduct && createPortal(
        <div className="oform-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="oform-modal" role="dialog" aria-modal="true" aria-label={`Details of ${mProduct.description || mProduct.code}`}>
            <button type="button" className="oform-modal-x" aria-label="Close" onClick={closeModal}><i className="fa-solid fa-xmark" /></button>

            <div className="oform-modal-media"><ProductImg p={mProduct} /></div>

            <div className="oform-modal-body">
              <span className="oform-modal-eyebrow"><i className="fa-solid fa-circle-info" /> Product details</span>
              <h3>{mProduct.description || mProduct.code}</h3>
              <small className="hub-mono">{mProduct.code}{mProduct.category ? ` - ${mProduct.category}` : ""}</small>

              <div className="oform-modal-price">
                <span>{showPromo ? "Your price" : "Client price"}</span>
                <strong>{gbp(mProduct.unitPrice)}</strong>
              </div>

              <div className="oform-modal-field">
                <label>Quantity</label>
                <Stepper value={mQty} min={1} label={mProduct.description || mProduct.code} onChange={setMQty} />
              </div>

              <div className="oform-modal-total">
                <span>Item total</span>
                <div><b>{gbp(mTotal)}</b></div>
              </div>

              {/* ----- REMARK (product popup) - the placer's own remark ----- */}
              <RemarkBox
                id="pm-remark"
                className="oform-modal-remark"
                icon={isManager ? "fa-user-tie" : "fa-comment-dots"}
                label={isManager ? "Area manager remark" : "Client remark"}
                value={ownRemark}
                onChange={setOwnRemark}
                rows={2}
                placeholder="Delivery instructions, special notes..."
              />

              <div className="oform-modal-actions">
                <button type="button" className="oform-modal-cancel" onClick={closeModal}>Close</button>
                <button type="button" className="oform-modal-ok" onClick={confirmModal} disabled={mQty < 1}>
                  <i className="fa-solid fa-cart-plus" /> {(qty[mProduct.code] || 0) > 0 ? "Update cart" : "Add to cart"}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* toast */}
      {toast && createPortal(
        <div className="oform-toast" role="status">
          <i className="fa-solid fa-circle-check" /> <span>{toast}</span>
          {step === "shop" && (
            <button type="button" onClick={() => { setToast(""); goStep("cart"); }}>View cart</button>
          )}
        </div>,
        document.body
      )}
    </section>
  );
}