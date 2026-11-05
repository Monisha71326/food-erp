import { CURRENCY } from "@/config/constants.js";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/* "2026-02-13" -> "13 Feb 2026" */
export function fmtDate(iso) {
  if (!iso) return "--";
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/* 1234.5 -> "£1,234.50" (decimals = 2) */
export function money(n, decimals = 0) {
  return `${CURRENCY}${Number(n).toLocaleString("en-GB", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}
