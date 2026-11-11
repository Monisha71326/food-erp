/*
 * Front-end only authentication (no server).
 * Accounts live in the browser's localStorage ("meg-users"); passwords are never stored in plain text
 * (PBKDF2-SHA256 with a random salt). The signed-in session is kept in localStorage ("Remember me")
 * or sessionStorage (until the tab closes).
 *
 * NOTE: because there is no backend, this protects the UI, not real data. Connect a real API later
 * and swap the functions in this file — the screens only use:
 * initAuth, login, register, currentUser, logout, verifyResetIdentity, resetPassword.
 */
import { createClientAccount, createManagerAccount, listClients, getAccountContact } from "@/data/localDb.js";

const USERS_KEY = "meg-users";
const SESSION_KEY = "meg-session";
export const ADMIN_ACCESS_CODE = "MEG-ADMIN-2026"; // needed to self-register as Admin / ERP Administrator
export const MIN_PASSWORD = 6;

const PHONE_RE = /^[+\d][\d\s()-]{6,18}$/;
// Indian 6-digit pincode (600001) OR UK postcode (SW1A 1AA)
const PINCODE_RE = /^([1-9]\d{5}|[A-Za-z]{1,2}\d[A-Za-z\d]?\s?\d[A-Za-z]{2})$/;

/* ---------- storage helpers ---------- */
const read = (store, key, fallback) => { try { const v = JSON.parse(store.getItem(key)); return v ?? fallback; } catch { return fallback; } };
const write = (store, key, value) => { try { store.setItem(key, JSON.stringify(value)); } catch { /* blocked */ } };
const users = () => read(localStorage, USERS_KEY, []);
const saveUsers = (list) => write(localStorage, USERS_KEY, list);

/* ---------- password hashing ---------- */
const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
async function hashPassword(password, salt) {
  if (globalThis.crypto?.subtle) {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: new TextEncoder().encode(salt), iterations: 100000, hash: "SHA-256" }, key, 256);
    return toHex(bits);
  }
  // fallback for non-secure contexts (plain http on a LAN address): simple salted hash
  let h = 2166136261;
  for (const ch of salt + password) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return "f" + (h >>> 0).toString(16);
}
const newSalt = () => toHex(crypto.getRandomValues(new Uint8Array(16)));

/* ---------- demo accounts (created once on first run) ---------- */
const DEMO = [
  { username: "admin",      password: "Admin@123",  name: "John Doe",         role: "erp",     linkedId: "ERP" },
  { username: "backoffice", password: "Office@123", name: "Back Office",      role: "admin",   linkedId: "ADMIN" },
  { username: "priya",      password: "Priya@123",  name: "Priya Shah",       role: "manager", linkedId: "AM1" },
  { username: "tom",        password: "Tom@123",    name: "Tom Whitfield",    role: "manager", linkedId: "AM2" },
  { username: "spice",      password: "Spice@123",  name: "Spice Market Ltd", role: "client",  linkedId: "C1" },
  { username: "greenleaf",  password: "Green@123",  name: "Green Leaf Grocers", role: "client", linkedId: "C2" },
  { username: "alnoor",     password: "Alnoor@123", name: "Al-Noor Wholesale", role: "client", linkedId: "C3" },
  { username: "riverside",  password: "River@123",  name: "Riverside Deli",   role: "client",  linkedId: "C4" },
];
export async function initAuth() {
  if (users().length) return;
  const list = [];
  for (const d of DEMO) {
    const salt = newSalt();
    list.push({ username: d.username, salt, hash: await hashPassword(d.password, salt), name: d.name, role: d.role, linkedId: d.linkedId, createdAt: Date.now() });
  }
  saveUsers(list);
}

/* ---------- session ---------- */
const publicUser = (u) => ({ username: u.username, name: u.name, role: u.role, id: u.linkedId });
function startSession(u, remember) {
  sessionStorage.removeItem(SESSION_KEY); localStorage.removeItem(SESSION_KEY);
  write(remember ? localStorage : sessionStorage, SESSION_KEY, { username: u.username });
}
export function currentUser() {
  const s = read(sessionStorage, SESSION_KEY, null) || read(localStorage, SESSION_KEY, null);
  const u = s && users().find((x) => x.username === s.username);
  return u ? publicUser(u) : null;
}
export function logout() { try { sessionStorage.removeItem(SESSION_KEY); localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ } }

/* ---------- login / register ---------- */
const norm = (s) => String(s || "").trim().toLowerCase();
const attempts = {}; // username -> { n, until }

/* -> { ok:true, user } | { ok:false, msg } */
export async function login({ username, password, role, remember }) {
  const name = norm(username);
  if (!name || !password) return { ok: false, msg: "Enter your username and password." };
  const a = attempts[name] || (attempts[name] = { n: 0, until: 0 });
  if (Date.now() < a.until) return { ok: false, msg: `Too many attempts. Try again in ${Math.ceil((a.until - Date.now()) / 1000)}s.` };
  const u = users().find((x) => x.username === name);
  const good = u && (await hashPassword(password, u.salt)) === u.hash;
  if (!good) {
    a.n += 1;
    if (a.n >= 5) { a.n = 0; a.until = Date.now() + 30000; return { ok: false, msg: "Too many failed attempts. Locked for 30 seconds." }; }
    return { ok: false, msg: "Incorrect username or password." };
  }
  if (role && u.role !== role) return { ok: false, msg: "This account is not registered for the role you selected. Pick the right role and try again." };
  a.n = 0;
  startSession(u, remember);
  return { ok: true, user: publicUser(u) };
}

/* ---------- forgot password ----------
   No server = no email. The person proves who they are with a detail only they know:
     client  -> the email registered on the account
     manager -> full name (or registered email)
     admin / erp -> the admin access code
   Then a short-lived reset token (kept in memory only) lets them choose a new password. */
const RESET_TTL = 10 * 60 * 1000; // 10 minutes
const resetTokens = {};   // token -> { username, until }
const resetAttempts = {}; // username -> { n, until }
const VERIFY_FAIL = "We could not verify those details. Check your username, role and detail, then try again.";

/* -> { ok:true, token } | { ok:false, msg } */
export async function verifyResetIdentity({ username, role, proof }) {
  const name = norm(username);
  const given = String(proof || "").trim();
  if (!name) return { ok: false, msg: "Enter your username." };
  if (!given) return { ok: false, msg: "Enter the verification detail asked for." };

  const a = resetAttempts[name] || (resetAttempts[name] = { n: 0, until: 0 });
  if (Date.now() < a.until) return { ok: false, msg: `Too many attempts. Try again in ${Math.ceil((a.until - Date.now()) / 1000)}s.` };

  const u = users().find((x) => x.username === name);
  let good = false;
  if (u && u.role === role) {
    if (u.role === "client") {
      good = norm(getAccountContact(u.linkedId)?.email) === norm(given);
    } else if (u.role === "manager") {
      const email = norm(getAccountContact(u.linkedId)?.email);
      good = norm(u.name) === norm(given) || (!!email && email === norm(given));
    } else {
      good = given === ADMIN_ACCESS_CODE;
    }
  }

  if (!good) {
    a.n += 1;
    if (a.n >= 5) { a.n = 0; a.until = Date.now() + 30000; return { ok: false, msg: "Too many failed attempts. Locked for 30 seconds." }; }
    return { ok: false, msg: VERIFY_FAIL };
  }

  a.n = 0;
  const token = newSalt();
  resetTokens[token] = { username: name, until: Date.now() + RESET_TTL };
  return { ok: true, token };
}

/* -> { ok:true } | { ok:false, msg, expired? } */
export async function resetPassword({ token, password, confirm }) {
  const t = resetTokens[token];
  if (!t || Date.now() > t.until) {
    delete resetTokens[token];
    return { ok: false, expired: true, msg: "This reset session has expired. Please verify again." };
  }
  if (String(password || "").length < MIN_PASSWORD) return { ok: false, msg: `Password must be at least ${MIN_PASSWORD} characters.` };
  if (password !== confirm) return { ok: false, msg: "Passwords do not match." };

  const list = users();
  const idx = list.findIndex((x) => x.username === t.username);
  if (idx < 0) {
    delete resetTokens[token];
    return { ok: false, expired: true, msg: "This reset session has expired. Please verify again." };
  }
  const salt = newSalt();
  list[idx] = { ...list[idx], salt, hash: await hashPassword(password, salt) };
  saveUsers(list);

  delete resetTokens[token];
  delete attempts[t.username]; // clear any login lock for this user
  return { ok: true };
}

export const registrableClients = () => listClients();
/* live "is this username free?" check for the Register screen */
export const usernameTaken = (name) => users().some((x) => x.username === norm(name));

/* -> { ok:true, user } | { ok:false, msg } */
export async function register(f) {
  const username = norm(f.username);
  const fullName = String(f.fullName || "").trim();
  if (!["client", "manager", "admin", "erp"].includes(f.role)) return { ok: false, msg: "Choose a role." };
  if (fullName.length < 2) return { ok: false, msg: "Enter your full name." };
  if (!/^[a-z0-9._-]{3,24}$/.test(username)) return { ok: false, msg: "Username must be 3–24 characters: letters, numbers, dot, dash or underscore." };
  if (users().some((x) => x.username === username)) return { ok: false, msg: "That username is already taken." };
  if (String(f.password || "").length < MIN_PASSWORD) return { ok: false, msg: `Password must be at least ${MIN_PASSWORD} characters.` };
  if (f.password !== f.confirm) return { ok: false, msg: "Passwords do not match." };

  let linkedId;
  if (f.role === "client") {
    const company = String(f.company || "").trim();
    const phone = String(f.phone || "").trim();
    const address = String(f.address || "").trim();
    const pincode = String(f.pincode || "").trim();
    if (company.length < 2) return { ok: false, msg: "Enter your company / shop name." };
    if (!/^\S+@\S+\.\S+$/.test(String(f.email || "").trim())) return { ok: false, msg: "Enter a valid email address." };
    if (!phone) return { ok: false, msg: "Phone number is required." };
    if (!PHONE_RE.test(phone)) return { ok: false, msg: "Enter a valid phone number." };
    if (address.length < 5) return { ok: false, msg: "Address is required." };
    if (!pincode) return { ok: false, msg: "Pincode / postcode is required." };
    if (!PINCODE_RE.test(pincode)) return { ok: false, msg: "Enter a valid pincode (e.g. 600001) or postcode." };
    linkedId = createClientAccount({
      company,
      contact: fullName,
      email: f.email.trim(),
      phone,
      address,
      pincode,
    });
  } else if (f.role === "manager") {
    linkedId = createManagerAccount({ name: fullName, clientIds: Array.isArray(f.clientIds) ? f.clientIds : [] });
  } else {
    if (String(f.accessCode || "").trim() !== ADMIN_ACCESS_CODE) return { ok: false, msg: "Invalid admin access code." };
    linkedId = f.role === "erp" ? "ERP" : "ADMIN";
  }

  const salt = newSalt();
  const u = { username, salt, hash: await hashPassword(f.password, salt), name: fullName, role: f.role, linkedId, createdAt: Date.now() };
  saveUsers([...users(), u]);
  // no auto-login: the person is sent to the Sign in screen after registering
  return { ok: true, user: publicUser(u) };
}