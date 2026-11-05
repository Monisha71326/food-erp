/*
 * Tiny promise-based confirm dialog store.
 *   const ok = await askConfirm({ ...details });   // true = confirmed, false = cancelled
 * <ConfirmHost /> (mounted once in App.jsx) renders it.
 */
import { useSyncExternalStore } from "react";

let current = null; // { details, resolve }
const listeners = new Set();
const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const emit = () => listeners.forEach((fn) => fn());

export function askConfirm(details) {
  // if one is already open, cancel it first
  if (current) current.resolve(false);
  return new Promise((resolve) => {
    current = { details, resolve };
    emit();
  });
}

export function closeConfirm(result) {
  if (!current) return;
  const { resolve } = current;
  current = null;
  emit();
  resolve(result);
}

export const useConfirm = () => useSyncExternalStore(subscribe, () => current);