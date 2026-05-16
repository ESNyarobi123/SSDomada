#!/usr/bin/env node
// Call the production "Unauthorize" endpoint for a given MAC and verify
// the effect. Mirrors exactly what OmadaService.deauthorizeClient does.
//
// Usage: node scripts/unauth-omada-client.mjs <MAC>

import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import { fileURLToPath } from "node:url";

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
    ) value = value.slice(1, -1);
    if (!(key in process.env)) process.env[key] = value;
  }
}

const OMADA_URL = (process.env.OMADA_URL || "").replace(/\/+$/, "");
const CID = (process.env.OMADA_CONTROLLER_ID || "").trim();
const CLIENT_ID = process.env.OMADA_CLIENT_ID || "";
const CLIENT_SECRET = process.env.OMADA_CLIENT_SECRET || "";

const rawMac = (process.argv[2] || "").trim();
if (!rawMac) {
  console.error("Usage: node scripts/unauth-omada-client.mjs <MAC>");
  process.exit(1);
}
const macHex = rawMac.replace(/[:-]/g, "").toUpperCase();
if (!/^[0-9A-F]{12}$/.test(macHex)) {
  console.error(`Invalid MAC: ${rawMac}`);
  process.exit(1);
}
const mac = macHex.match(/.{2}/g).join("-");

function nodeFetch(url, init = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const headers = { Accept: "application/json", ...(init.headers || {}) };
    const req = https.request(
      {
        method: init.method || "GET",
        host: u.hostname,
        port: u.port || 443,
        path: u.pathname + u.search,
        headers,
        agent: new https.Agent({ rejectUnauthorized: false }),
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          let parsed = null;
          try { parsed = JSON.parse(data); } catch {}
          resolve({ status: res.statusCode, parsed });
        });
      },
    );
    req.on("error", reject);
    if (init.body) req.write(init.body);
    req.end();
  });
}

const AUTH = {
  0: "NOT_AUTHORIZED",
  1: "AUTHORIZING",
  2: "AUTHORIZED",
  3: "AUTH_FAILED",
};

(async () => {
  const t0 = Date.now();
  const login = await nodeFetch(
    `${OMADA_URL}/openapi/authorize/token?grant_type=client_credentials`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ omadacId: CID, client_id: CLIENT_ID, client_secret: CLIENT_SECRET }),
    },
  );
  if (login.parsed?.errorCode !== 0) {
    console.error("Login failed:", login.parsed?.msg);
    process.exit(1);
  }
  const token = login.parsed.result.accessToken;

  // Find which site has this MAC.
  const sites = (
    await nodeFetch(`${OMADA_URL}/openapi/v1/${CID}/sites?page=1&pageSize=100`, {
      headers: { Authorization: `AccessToken=${token}` },
    })
  ).parsed?.result?.data || [];
  let siteId = null;
  for (const s of sites) {
    const c = (
      await nodeFetch(`${OMADA_URL}/openapi/v1/${CID}/sites/${s.siteId}/clients/${mac}`, {
        headers: { Authorization: `AccessToken=${token}` },
      })
    ).parsed;
    if (c?.errorCode === 0) {
      siteId = s.siteId;
      console.log(`Found ${mac} in site ${s.name} (${siteId})`);
      console.log(
        `Before: authStatus=${c.result.authStatus}(${AUTH[c.result.authStatus] || "?"}) active=${c.result.active} ip=${c.result.ip} ssid=${c.result.ssid}`,
      );
      break;
    }
  }
  if (!siteId) {
    console.error(`MAC ${mac} not found in any site — phone may not be connected`);
    process.exit(1);
  }

  // The real Unauthorize call.
  const unauthPath = `/openapi/v1/${CID}/sites/${siteId}/hotspot/clients/${mac}/unauth`;
  const r = await nodeFetch(`${OMADA_URL}${unauthPath}`, {
    method: "POST",
    headers: { Authorization: `AccessToken=${token}`, "Content-Type": "application/json" },
    body: "{}",
  });
  console.log(
    `\nPOST ${unauthPath}\n→ status=${r.status} errorCode=${r.parsed?.errorCode} msg=${r.parsed?.msg}`,
  );

  if (r.parsed?.errorCode !== 0) {
    console.error("Unauthorize REJECTED by controller");
    process.exit(1);
  }

  // Verify the auth state actually changed.
  for (let i = 0; i < 5; i++) {
    await new Promise((res) => setTimeout(res, 1000));
    const c = (
      await nodeFetch(`${OMADA_URL}/openapi/v1/${CID}/sites/${siteId}/clients/${mac}`, {
        headers: { Authorization: `AccessToken=${token}` },
      })
    ).parsed;
    if (c?.errorCode !== 0) {
      console.log(`After +${i + 1}s: client GONE (errorCode=${c?.errorCode})`);
    } else {
      console.log(
        `After +${i + 1}s: authStatus=${c.result.authStatus}(${AUTH[c.result.authStatus] || "?"}) active=${c.result.active} ip=${c.result.ip ?? "?"}`,
      );
    }
  }

  console.log(`\nTotal ${Date.now() - t0}ms`);
  console.log(
    "\n✅ Unauthorize call succeeded. Phone should now see the captive portal on next HTTP request.",
  );
})();
