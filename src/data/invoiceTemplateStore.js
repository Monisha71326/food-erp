import { useSyncExternalStore } from "react";

/* Invoice template settings (frontend only, kept in localStorage).
   To go live later, replace read()/write() with API calls.
   Colours are stored PER TEMPLATE: colors[templateId] = { accentMode, accent, gradFrom, gradTo, gradAngle } */
const KEY = "meg-invoice-template";

export const TEMPLATES = [
  { id: "trade", name: "Trade", desc: "Supplier style: From + logo, To box, Quantity / Details table, bank box, totals and signature line." },
  { id: "classic", name: "Classic", desc: "Centered header with a title pill. Clean and traditional." },
  { id: "modern", name: "Modern", desc: "Bold colour header bar with the invoice number on the right." },
  { id: "minimal", name: "Minimal", desc: "Black & white, lots of white space, thin lines." },
  { id: "corporate", name: "Corporate", desc: "Split header, striped table and a highlighted total box." },
];

/* Plain colours */
export const ACCENT_PRESETS = ["#a1122f", "#1e40af", "#0f766e", "#7c3aed", "#ea580c", "#111827"];

/* Ready-made gradients (from -> to) */
export const GRADIENT_PRESETS = [
  { name: "Sunset", from: "#a1122f", to: "#ea580c" },
  { name: "Ocean", from: "#1e40af", to: "#06b6d4" },
  { name: "Royal", from: "#1e40af", to: "#7c3aed" },
  { name: "Berry", from: "#7c3aed", to: "#db2777" },
  { name: "Forest", from: "#0f766e", to: "#65a30d" },
  { name: "Midnight", from: "#111827", to: "#4338ca" },
];

const COLOR_KEYS = ["accentMode", "accent", "gradFrom", "gradTo", "gradAngle"];

const DEFAULT_COLORS = {
  accentMode: "plain", // "plain" | "gradient"
  accent: "#a1122f", // plain colour
  gradFrom: "#a1122f", // gradient start
  gradTo: "#ea580c", // gradient end
  gradAngle: 90, // degrees (90 = left to right)
};

/* Trade template starts green (matches the Rockcliffe logo); the other templates keep the red default */
const colorsFor = (id) => (id === "trade" ? { ...DEFAULT_COLORS, accent: "#2f9e44", gradFrom: "#2f9e44", gradTo: "#8bc34a" } : { ...DEFAULT_COLORS });

export const DEFAULT_INVOICE_TEMPLATE = {
  templateId: "trade",
  companyName: "Zulekha Order Hub",
  address: "",
  vatNo: "",
  /* bank details: typed in Settings -> Invoice Templates, nothing is hard-coded here */
  bankName: "",
  accountName: "",
  accountNumber: "",
  sortCode: "",
  iban: "",
  colors: Object.fromEntries(TEMPLATES.map((t) => [t.id, colorsFor(t.id)])),
  title: "Invoice",
  footerNote: "Thank you for your business.",
  terms: "",
  showPaidStamp: true,
};

const HEX = /^#[0-9a-f]{6}$/i;
export const isHex = (v) => HEX.test(String(v || ""));

/* One place that turns the colour settings into CSS:
   solid = single colour (text, thin lines), image = linear-gradient(...) used for backgrounds */
export function accentCss(tpl = {}) {
  const base = isHex(tpl.accent) ? tpl.accent : DEFAULT_COLORS.accent;
  if (tpl.accentMode === "gradient") {
    const from = isHex(tpl.gradFrom) ? tpl.gradFrom : base;
    const to = isHex(tpl.gradTo) ? tpl.gradTo : base;
    const angle = Math.min(360, Math.max(0, Number(tpl.gradAngle) || 0));
    return { solid: from, image: `linear-gradient(${angle}deg, ${from}, ${to})` };
  }
  return { solid: base, image: `linear-gradient(${base}, ${base})` };
}

/* Old saved data (top-level colours) -> per-template colours */
function normalize(raw = {}) {
  const legacy = {};
  COLOR_KEYS.forEach((k) => { if (raw[k] !== undefined) legacy[k] = raw[k]; });
  const colors = {};
  TEMPLATES.forEach((t) => {
    colors[t.id] = { ...colorsFor(t.id), ...legacy, ...(raw.colors?.[t.id] || {}) };
  });
  const out = { ...DEFAULT_INVOICE_TEMPLATE, ...raw, colors };
  COLOR_KEYS.forEach((k) => delete out[k]);

  return out;
}

/* Flatten the colours of one template into top-level fields (used by InvoiceDocument) */
export function resolveTpl(tpl, id = tpl.templateId) {
  return { ...tpl, templateId: id, ...(tpl.colors?.[id] || DEFAULT_COLORS) };
}

const listeners = new Set();
let cache = null;

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    return normalize(raw ? JSON.parse(raw) : {});
  } catch {
    return normalize({});
  }
}

export function getInvoiceTemplate() {
  if (!cache) cache = read();
  return cache;
}

function emit() {
  listeners.forEach((l) => l());
}

export function saveInvoiceTemplate(next) {
  cache = normalize(next);
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* storage full / blocked */ }
  emit();
  return cache;
}

export function resetInvoiceTemplate() {
  return saveInvoiceTemplate({ ...DEFAULT_INVOICE_TEMPLATE });
}

function subscribe(cb) {
  listeners.add(cb);
  const onStorage = (e) => {
    if (e.key === KEY) { cache = read(); cb(); }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function useInvoiceTemplate() {
  return useSyncExternalStore(subscribe, getInvoiceTemplate, getInvoiceTemplate);
}