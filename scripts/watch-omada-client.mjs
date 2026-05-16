#!/usr/bin/env node
// Poll the Omada controller for a client's state every 2 seconds.
// Useful for watching what happens when you click Unauthorize / Block /
// Forget on the UI.
//
// Usage: node scripts/watch-omada-client.mjs <MAC>

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
const OMADA_CID = (process.env.OMADA_CONTROLLER_ID || "").trim();
const CLIENT_ID = process.env.OMADA_CLIENT_ID || "";
const CLIENT_SECRET = process.env.OMADA_CLIENT_SECRET || "";

const rawMac = (process.argv[2] || "").trim();
if (!rawMac) {
  console.error("Usage: node scripts/watch-omada-client.mjs <MAC>");
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
    const headers = {
      "User-Agent": "Mozilla/5.0",
      Accept: "application/json",
      ...(init.headers || {}),
    };
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
          resolve({ status: res.statusCode, headers: res.headers, parsed });
        });
      },
    );
    req.on("error", reject);
    if (init.body) req.write(init.body);
    req.end();
  });
}

async function login() {
  const res = await nodeFetch(`${OMADA_URL}/openapi/authorize/token?grant_type=client_credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      omadacId: OMADA_CID,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
  });
  if (res.parsed?.errorCode !== 0) {
    throw new Error(`Login failed: ${res.parsed?.msg}`);
  }
  return res.parsed.result.accessToken;
}

const AUTH_STATUS_LABEL = {
  0: "NOT_AUTHORIZED",
  1: "AUTHORIZING",
  2: "AUTHORIZED (captive portal passed)",
  3: "AUTH_FAILED",
};

async function lookup(token, siteId) {
  const url = `${OMADA_URL}/openapi/v1/${OMADA_CID}/sites/${siteId}/clients/${mac}`;
  const res = await nodeFetch(url, {
    headers: { Authorization: `AccessToken=${token}` },
  });
  return res.parsed;
}

async function findSite(token) {
  const res = await nodeFetch(`${OMADA_URL}/openapi/v1/${OMADA_CID}/sites?page=1&pageSize=100`, {
    headers: { Authorization: `AccessToken=${token}` },
  });
  const sites = res.parsed?.result?.data || [];
  for (const s of sites) {
    const c = await lookup(token, s.siteId);
    if (c?.errorCode === 0) return s.siteId;
  }
  return sites[0]?.siteId;
}

(async () => {
  const token = await login();
  console.log("Logged in. Watching client", mac);
  const siteId = await findSite(token);
  console.log("Site:", siteId);

  let lastKey = "";
  while (true) {
    try {
      const c = await lookup(token, siteId);
      let line;
      if (c?.errorCode !== 0) {
        line = `[gone] errorCode=${c?.errorCode} msg=${c?.msg}`;
      } else {
        const r = c.result;
        line = `auth=${r.authStatus}(${AUTH_STATUS_LABEL[r.authStatus] || "?"}) active=${r.active} wireless=${r.wireless} guest=${r.guest} block=${r.block ?? "?"} signalLevel=${r.signalLevel ?? "?"} ip=${r.ip ?? "?"} ssid=${r.ssid ?? "?"} ap=${r.apName ?? "?"}`;
      }
      if (line !== lastKey) {
        const ts = new Date().toISOString().slice(11, 19);
        console.log(`[${ts}] ${line}`);
        lastKey = line;
      }
    } catch (e) {
      console.log(`[${new Date().toISOString().slice(11, 19)}] error: ${e.message}`);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
})();
