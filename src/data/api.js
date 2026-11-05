/*
 * Order Hub "API" — runs entirely in the browser (see localDb.js). No server needed.
 * It never throws: rule failures come back as { ok:false, msg }.
 */
import { hubRequest } from "@/data/localDb.js";

export const BASE = "";

export async function api(method, path, body) {
  return hubRequest(method, path, body);
}
