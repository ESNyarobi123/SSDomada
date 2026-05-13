# Pre-authentication access (captive portal) — reference hostnames

Omada (and most controllers) let you allow specific **URLs / IPs / domains** before the user completes portal login. Phones and laptops **probe well-known hosts** to learn whether the network is “free internet” or **captive**; if those probes are blocked or broken, users may not get the sign-in sheet (or payments may fail).

SSDomada does **not** push this list to Omada via Open API today (TP-Link’s public docs/community threads do not expose a stable “set pre-auth list” endpoint for all builds). Configure it **manually** in the controller, using the table below as a checklist.

---

## Why Google / Apple / Microsoft appear

| Platform | What it does | Official / vendor evidence |
|----------|----------------|---------------------------|
| **Apple (iOS / iPadOS / macOS)** | CNA / captive detection (legacy `captive.apple.com`, modern DHCP option 114 flow) | [Modernize your captive network](https://developer.apple.com/news/?id=q78sq5rv) — Apple Developer |
| **Android** | Captive portal API, probes (versions vary) | [Captive portal API (Android 11+)](https://developer.android.com/about/versions/11/features/captive-portal) — Android Developers |
| **Windows** | NCSI / connect test | [NCSI overview](https://learn.microsoft.com/en-us/windows-server/networking/ncsi/ncsi-overview) — Microsoft Learn; captive behaviour: [Captive Portal Detection and User Experience in Windows](https://learn.microsoft.com/en-us/windows-hardware/drivers/mobilebroadband/captive-portals) |
| **ChromeOS (enterprise Wi‑Fi)** | May need extra HTTP/HTTPS allowlist through firewall for detection | [Configure captive portal detection on managed Wi‑Fi](https://support.google.com/chrome/a/answer/16216153) — Google Chrome Enterprise Help |

“McDonald’s / Starbucks style” networks are the same mechanism: the **OS vendor probes** decide whether to pop the **sign-in network** UI; your **external portal URL** is separate.

---

## Suggested hostname allowlist (add in Omada UI)

**Always include your own stack (replace with your real domains):**

- Public app (portal pages, API, static uploads): e.g. `ssdomada.site` (and `www.` if you use it).
- Snippe: derive host from `SNIPPE_API_URL` (e.g. `api.snippe.co.tz`) plus any checkout / CDN hostnames Snippe documents in their dashboard or support.

**OS captive detection (commonly cited in operator / Android community threads):**

- `captive.apple.com` — Apple hotspot / captive detection (widely referenced; see Apple Developer link above).
- `www.apple.com` — sometimes used alongside Apple checks (community / firewall guides).
- `connectivitycheck.gstatic.com` — Android / Google connectivity checks (see Android captive portal docs and AOSP `CaptivePortalProbeSpec`).
- `clients3.google.com` — often listed in Android captive / firewall threads (e.g. Stack Exchange discussions on mis-detection).
- `www.msftconnecttest.com` — Windows NCSI text probe (Microsoft Learn NCSI / captive portal docs).
- `dns.msftncsi.com` — Windows NCSI DNS probe hostname (Microsoft Learn).

**Optional (only if TLS inspection or strict firewall breaks things):**

- Other `*.gstatic.com` / `*.google.com` entries only if your monitoring shows blocks — keep the list as small as possible for security.

---

## What not to confuse

- **Pre-auth allowlist** = “who can talk **before** login completes”.
- **External portal URL** in Omada = where the **browser is sent** for SSDomada `/portal/{brand}` (set from app / `OMADA_PORTAL_PUBLIC_BASE_URL` + `NEXT_PUBLIC_APP_URL`).
- **LAN IP of the customer’s router** is **not** a substitute for your portal HTTPS URL on the public internet.

---

## `.env` note

You can keep a **private note** in your deployment runbook (or a non-secret comment block) listing the exact hostnames you entered in Omada. A long comma-separated secret in `.env` is **not** required for the portal to work unless you later add automation that reads it.

If we add Omada Open API support for pre-auth in the future, a single variable such as `OMADA_PREAUTH_HOSTS` (comma-separated) could drive that — today it is **documentation + manual UI**.
