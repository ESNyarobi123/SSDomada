#!/usr/bin/env node
// Probe the Omada controller for a working "unauthorize / cancelAuth" endpoint.
//
// Usage:
//   node scripts/probe-omada-unauthorize.mjs <MAC> [siteId]
//
// Examples:
//   node scripts/probe-omada-unauthorize.mjs E2-24-58-EF-B9-B5
//   node scripts/probe-omada-unauthorize.mjs E2-24-58-EF-B9-B5 6a048785b18cb07f8cafa979
//
// Reads OMADA_* env vars from .env. Tries every candidate endpoint we know
// of and prints which (if any) succeed. Does NOT need redis or prisma.

import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import { fileURLToPath } from "node:url";

// ─── Load .env ────────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  for (const raw of fs.readFileSync(envPath, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

const OMADA_URL = (process.env.OMADA_URL || "").replace(/\/+$/, "");
const OMADA_CONTROLLER_ID = (process.env.OMADA_CONTROLLER_ID || "").trim();
const CLIENT_ID = process.env.OMADA_CLIENT_ID || "";
const CLIENT_SECRET = process.env.OMADA_CLIENT_SECRET || "";
const HOTSPOT_USER = process.env.OMADA_HOTSPOT_USERNAME || "";
const HOTSPOT_PASS = process.env.OMADA_HOTSPOT_PASSWORD || "";
const TLS_INSECURE = process.env.OMADA_HOTSPOT_TLS_INSECURE === "true";

if (!OMADA_URL || !OMADA_CONTROLLER_ID) {
  console.error("Missing OMADA_URL or OMADA_CONTROLLER_ID in .env");
  process.exit(1);
}

const agent = TLS_INSECURE
  ? new https.Agent({ rejectUnauthorized: false })
  : undefined;

const rawMac = (process.argv[2] || "").trim();
const siteArg = (process.argv[3] || "").trim();
if (!rawMac) {
  console.error("Usage: node probe-omada-unauthorize.mjs <MAC> [siteId]");
  process.exit(1);
}

const macHex = rawMac.replace(/[:-]/g, "").toUpperCase();
if (!/^[0-9A-F]{12}$/.test(macHex)) {
  console.error(`Invalid MAC: ${rawMac}`);
  process.exit(1);
}
const macHyphen = macHex.match(/.{2}/g).join("-");
const macColon = macHex.match(/.{2}/g).join(":");

// ─── Helpers ──────────────────────────────────────────────────────────────
async function fetchSafe(url, init = {}) {
  // Always use nodeFetch so `res.headers` is a plain object (not Headers map).
  // This makes set-cookie inspection consistent. globalThis.fetch would
  // require getSetCookie()/get() and we'd lose the array form.
  return nodeFetch(url, init);
}

function nodeFetch(url, init) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    // The user-agent string and Accept header matter: some Omada builds
    // refuse to return Set-Cookie unless a browser-like UA is present.
    const headers = {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
      Accept: "application/json, text/plain, */*",
      ...(init.headers || {}),
    };
    const req = https.request(
      {
        method: init.method || "GET",
        host: u.hostname,
        port: u.port || (u.protocol === "https:" ? 443 : 80),
        path: u.pathname + u.search,
        headers,
        agent: agent || new https.Agent({ rejectUnauthorized: false }),
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            text: async () => data,
            json: async () => {
              try { return JSON.parse(data); } catch { return null; }
            },
          });
        });
      },
    );
    req.on("error", reject);
    if (init.body) req.write(init.body);
    req.end();
  });
}

// ─── OpenAPI (Bearer) login ───────────────────────────────────────────────
async function openApiLogin() {
  const url = `${OMADA_URL}/openapi/authorize/token?grant_type=client_credentials`;
  const res = await fetchSafe(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      omadacId: OMADA_CONTROLLER_ID,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
  });
  const parsed = await res.json();
  if (!parsed || parsed.errorCode !== 0) {
    throw new Error(`OpenAPI login failed: ${parsed?.msg || res.status}`);
  }
  return parsed.result.accessToken;
}

// ─── Hotspot (Cookie) login ───────────────────────────────────────────────
async function hotspotLogin() {
  const url = `${OMADA_URL}/${OMADA_CONTROLLER_ID}/api/v2/hotspot/login`;
  const res = await fetchSafe(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: HOTSPOT_USER, password: HOTSPOT_PASS }),
  });
  const parsed = await res.json();
  if (!parsed || parsed.errorCode !== 0) {
    throw new Error(`Hotspot login failed: ${parsed?.msg || res.status}`);
  }
  console.log("DEBUG hotspot login headers:", JSON.stringify(res.headers, null, 2).slice(0, 600));
  const setCookie = res.headers["set-cookie"] || res.headers["Set-Cookie"] || [];
  const cookieArr = Array.isArray(setCookie) ? setCookie : [setCookie];
  console.log("DEBUG raw set-cookie:", cookieArr);
  // Match TPOMADA_SESSIONID / TPEAP_SESSIONID anywhere in the header value.
  const cookie = cookieArr
    .flatMap((c) => {
      const out = [];
      const re = /(TPOMADA_SESSIONID|TPEAP_SESSIONID)=[^;\s]+/g;
      let m;
      while ((m = re.exec(c || "")) !== null) out.push(m[0]);
      return out;
    })
    .join("; ");
  if (!cookie) throw new Error("Hotspot login OK but no session cookie returned");
  return { token: parsed.result.token, cookie };
}

// ─── Probe runners ────────────────────────────────────────────────────────
async function probeOpenApi(siteId, accessToken) {
  console.log("\n========================================");
  console.log("== OpenAPI (Bearer)  candidates ========");
  console.log("========================================");

  const cid = OMADA_CONTROLLER_ID;
  const base = `${OMADA_URL}/openapi/v1/${cid}/sites/${siteId}`;
  // Get current client state first
  for (const mac of [macHyphen, macColon]) {
    const url = `${base}/clients/${mac}`;
    try {
      const res = await fetchSafe(url, {
        method: "GET",
        headers: { Authorization: `AccessToken=${accessToken}` },
      });
      const parsed = await res.json();
      console.log(
        `[lookup]  mac=${mac} status=${res.status} errorCode=${parsed?.errorCode} msg=${parsed?.msg?.slice(0, 80)} authStatus=${parsed?.result?.authStatus}`,
      );
      if (parsed?.errorCode === 0 && parsed.result) {
        console.log(
          `          → wireless=${parsed.result.wireless} guest=${parsed.result.guest} active=${parsed.result.active} authStatus=${parsed.result.authStatus}`,
        );
      }
    } catch (e) {
      console.log(`[lookup]  mac=${mac} threw: ${e.message}`);
    }
  }

  const candidates = [];
  for (const mac of [macHyphen, macColon]) {
    // PATCH/PUT/POST to update authStatus on the existing client record.
    // The UI button transitions auth=2 → auth=1 WITHOUT removing the
    // client, so the endpoint must be a status-change, not a delete.
    candidates.push(
      { method: "PATCH", path: `${base}/clients/${mac}`,                     body: { authStatus: 0 } },
      { method: "PATCH", path: `${base}/clients/${mac}`,                     body: { authStatus: 1 } },
      { method: "PUT",   path: `${base}/clients/${mac}`,                     body: { authStatus: 0 } },
      { method: "PUT",   path: `${base}/clients/${mac}`,                     body: { authStatus: 1 } },
      { method: "POST",  path: `${base}/clients/${mac}/setAuth`,             body: { authStatus: 0 } },
      { method: "POST",  path: `${base}/clients/${mac}/auth`,                body: { authStatus: 0 } },
      { method: "POST",  path: `${base}/clients/${mac}/auth`,                body: { authorized: false } },
      { method: "POST",  path: `${base}/clients/${mac}/unauth`,              body: {} },
      { method: "POST",  path: `${base}/clients/${mac}/unAuth`,              body: {} },
      { method: "POST",  path: `${base}/clients/${mac}/unauthorize`,         body: {} },
      { method: "POST",  path: `${base}/clients/${mac}/cancel`,              body: {} },
      // hotspot variants
      { method: "POST",  path: `${base}/hotspot/clients/${mac}/cancelAuth`,  body: {} },
      { method: "POST",  path: `${base}/hotspot/clients/${mac}/cancel-auth`, body: {} },
      { method: "POST",  path: `${base}/hotspot/clients/${mac}/unauthorize`, body: {} },
      { method: "POST",  path: `${base}/hotspot/clients/${mac}/unauth`,      body: {} },
      { method: "PATCH", path: `${base}/hotspot/clients/${mac}`,             body: { authStatus: 0 } },
      // /cmd/ variants
      { method: "POST",  path: `${base}/cmd/clients/${mac}/cancelAuth`,      body: {} },
      { method: "POST",  path: `${base}/cmd/clients/${mac}/unauthorize`,     body: {} },
      { method: "POST",  path: `${base}/cmd/clients/${mac}/unAuth`,          body: {} },
      // authorized-clients resource
      { method: "POST",  path: `${base}/authorized-clients/${mac}/cancel`,   body: {} },
      { method: "DELETE", path: `${base}/authorized-clients/${mac}`,         body: null },
      // hotspot/extPortal/deauth with body shapes
      { method: "POST",  path: `${base}/hotspot/extPortal/deauth`,           body: { clientMac: mac, mac, site: siteId } },
      // Baseline: the canonical DELETE — proves it HARD-deletes (client gone).
      { method: "DELETE", path: `${base}/clients/${mac}`,                    body: null },
    );
  }

  for (const c of candidates) {
    try {
      const init = {
        method: c.method,
        headers: {
          Authorization: `AccessToken=${accessToken}`,
          "Content-Type": "application/json",
        },
      };
      if (c.body !== null && c.body !== undefined) init.body = JSON.stringify(c.body);
      const res = await fetchSafe(c.path, init);
      const parsed = await res.json();
      const tag = parsed?.errorCode === 0 ? "✅ OK " : "  ";
      console.log(
        `${tag} ${c.method.padEnd(6)} status=${res.status} errorCode=${parsed?.errorCode ?? "?"} msg=${(parsed?.msg ?? "?").slice(0, 60)} path=${c.path.replace(`${OMADA_URL}/openapi/v1/${cid}/sites/${siteId}`, "")}`,
      );

      // If this candidate claims success, re-fetch the client and check whether
      // authStatus actually changed. authStatus=2 → still authorized; anything
      // else (0/undefined/missing) → actually unauthorized.
      if (parsed?.errorCode === 0) {
        await new Promise((r) => setTimeout(r, 800));
        const checkUrl = `${OMADA_URL}/openapi/v1/${cid}/sites/${siteId}/clients/${macHyphen}`;
        const r = await fetchSafe(checkUrl, {
          method: "GET",
          headers: { Authorization: `AccessToken=${accessToken}` },
        });
        const j = await r.json();
        if (j?.errorCode !== 0) {
          console.log(`     ↳ verify: client GONE (errorCode=${j?.errorCode}) — REAL UNAUTHORIZE 🎉`);
          return; // No point probing more — we found one that actually works.
        }
        const newAuth = j.result?.authStatus;
        if (newAuth !== 2) {
          console.log(`     ↳ verify: authStatus changed 2 → ${newAuth} — REAL UNAUTHORIZE 🎉`);
          return;
        } else {
          console.log(`     ↳ verify: authStatus still ${newAuth} — NO-OP (path lies about success)`);
        }
      }
    } catch (e) {
      console.log(`   ${c.method.padEnd(6)} threw: ${e.message} path=${c.path}`);
    }
  }
}

async function probeCookieUi(siteId, creds) {
  console.log("\n========================================");
  console.log("== Cookie/UI  (TPOMADA_SESSIONID) ======");
  console.log("========================================");

  const base = `${OMADA_URL}/${OMADA_CONTROLLER_ID}`;

  const candidates = [];
  for (const mac of [macHyphen, macColon, macHyphen.toLowerCase()]) {
    candidates.push(
      { method: "POST",   path: `/api/v2/sites/${siteId}/cmd/clients/${mac}/unauthorize`,            body: {} },
      { method: "POST",   path: `/api/v2/sites/${siteId}/hotspot/cmd/clients/${mac}/unauthorize`,    body: {} },
      { method: "POST",   path: `/api/v2/sites/${siteId}/cmd/clients/${mac}/cancel-auth`,            body: {} },
      { method: "POST",   path: `/api/v2/sites/${siteId}/cmd/clients/${mac}/cancelAuth`,             body: {} },
      { method: "POST",   path: `/api/v2/sites/${siteId}/cmd/clients/${mac}/portal-logout`,          body: {} },
      { method: "POST",   path: `/api/v2/sites/${siteId}/cmd/clients/${mac}/logout`,                 body: {} },
      { method: "DELETE", path: `/api/v2/sites/${siteId}/clients/${mac}`,                            body: null },
      { method: "DELETE", path: `/api/v2/sites/${siteId}/hotspot/clients/${mac}`,                    body: null },
      { method: "DELETE", path: `/api/v2/sites/${siteId}/hotspot/authorized-clients/${mac}`,         body: null },
      { method: "DELETE", path: `/api/v2/sites/${siteId}/insight/authorized-clients/${mac}`,         body: null },
      { method: "POST",   path: `/api/v2/sites/${siteId}/cmd/clients/${mac}/disconnect`,             body: {} },
    );
  }

  for (const c of candidates) {
    try {
      const init = {
        method: c.method,
        headers: {
          "Content-Type": "application/json",
          Cookie: creds.cookie,
          "Csrf-Token": creds.token,
        },
      };
      if (c.body !== null && c.body !== undefined) init.body = JSON.stringify(c.body);
      const res = await fetchSafe(`${base}${c.path}`, init);
      const parsed = await res.json();
      const tag = parsed?.errorCode === 0 ? "✅ OK " : "  ";
      console.log(
        `${tag} ${c.method.padEnd(6)} status=${res.status} errorCode=${parsed?.errorCode ?? "?"} msg=${(parsed?.msg ?? "?").slice(0, 60)} path=${c.path}`,
      );

      // Verify with the OpenAPI lookup whether authStatus actually changed.
      if (parsed?.errorCode === 0 && globalThis.__bearerToken) {
        await new Promise((r) => setTimeout(r, 800));
        const cid = OMADA_CONTROLLER_ID;
        const checkUrl = `${OMADA_URL}/openapi/v1/${cid}/sites/${siteId}/clients/${macHyphen}`;
        const r = await fetchSafe(checkUrl, {
          method: "GET",
          headers: { Authorization: `AccessToken=${globalThis.__bearerToken}` },
        });
        const j = await r.json();
        if (j?.errorCode !== 0) {
          console.log(`     ↳ verify: client GONE (errorCode=${j?.errorCode}) — REAL UNAUTHORIZE 🎉`);
          return;
        }
        const newAuth = j.result?.authStatus;
        if (newAuth !== 2) {
          console.log(`     ↳ verify: authStatus changed 2 → ${newAuth} — REAL UNAUTHORIZE 🎉`);
          return;
        } else {
          console.log(`     ↳ verify: authStatus still ${newAuth} — NO-OP (path lies about success)`);
        }
      }
    } catch (e) {
      console.log(`   ${c.method.padEnd(6)} threw: ${e.message} path=${c.path}`);
    }
  }
}

// ─── Find site ID for the MAC (if not provided) ───────────────────────────
async function findSiteForMac(accessToken) {
  const cid = OMADA_CONTROLLER_ID;
  const url = `${OMADA_URL}/openapi/v1/${cid}/sites?page=1&pageSize=100`;
  const res = await fetchSafe(url, {
    method: "GET",
    headers: { Authorization: `AccessToken=${accessToken}` },
  });
  const parsed = await res.json();
  if (parsed?.errorCode !== 0) throw new Error(`listSites failed: ${parsed?.msg}`);
  const sites = parsed.result.data || [];
  console.log(`\nFound ${sites.length} sites. Checking each for MAC ${macHyphen}...`);

  for (const s of sites) {
    const lookup = `${OMADA_URL}/openapi/v1/${cid}/sites/${s.siteId}/clients/${macHyphen}`;
    const r = await fetchSafe(lookup, {
      method: "GET",
      headers: { Authorization: `AccessToken=${accessToken}` },
    });
    const j = await r.json();
    if (j?.errorCode === 0) {
      console.log(`  → site ${s.siteId} (${s.name}) HAS this client`);
      return s.siteId;
    }
  }
  throw new Error(`MAC ${macHyphen} not found in any site`);
}

// ─── Main ─────────────────────────────────────────────────────────────────
(async () => {
  try {
    console.log(`Probing for MAC: ${macHyphen} (also ${macColon})`);
    console.log(`Controller: ${OMADA_URL}/${OMADA_CONTROLLER_ID}`);

    const accessToken = await openApiLogin();
    globalThis.__bearerToken = accessToken;
    console.log(`OpenAPI login OK (token len=${accessToken.length})`);

    const siteId = siteArg || (await findSiteForMac(accessToken));
    console.log(`Using siteId: ${siteId}`);

    let cookieCreds = null;
    try {
      cookieCreds = await hotspotLogin();
      console.log(`Hotspot cookie login OK (token len=${cookieCreds.token.length})`);
    } catch (e) {
      console.warn(`Hotspot login failed: ${e.message}`);
    }

    await probeOpenApi(siteId, accessToken);
    if (cookieCreds) await probeCookieUi(siteId, cookieCreds);

    console.log("\n========================================");
    console.log("Done. Lines tagged with '✅ OK' returned errorCode=0.");
    console.log("Pin the working one in .env, e.g.:");
    console.log("  OMADA_UI_UNAUTHORIZE_PATH=/api/v2/sites/{site}/cmd/clients/{mac}/unauthorize");
    console.log("  OMADA_UI_UNAUTHORIZE_METHOD=POST");
  } catch (e) {
    console.error("Probe failed:", e.message);
    process.exit(1);
  }
})();
