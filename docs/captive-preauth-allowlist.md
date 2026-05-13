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

## SSDomada: push portal URL + SSIDs (Open API)

After deploy, call **`POST /api/v1/reseller/omada/sync-portal`** (Bearer session token) to re-attach every **open** SSID that has an `omadaSsidId` to the site’s external portal on Omada. Optional JSON body: `{ "siteId": "<site cuid>" }` to limit to one site. Pre-authentication allowlist is still **manual** in Omada (see above).

---

## Hatua kwa hatua — reseller (portal + pre-authentication)

Hizi ni hatua **kwa mpangilio**. Sehemu ya SSDomada (dashboard) na sehemu ya **Omada Controller** (kivinjari).

### Sehemu A — SSDomada (dashboard ya reseller)

1. **Hakikisha akaunti iko tayari**  
   Ingia `https://ssdomada.site/login` kama reseller, uwe na **site** (eneo) na **SSID** iliyounganishwa na Omada (site ina `omadaSiteId` baada ya kuundwa au ku-link).

2. **Weka captive portal (branding)**  
   Nenda **Captive portal** → pakia logo/msingi ikiwa unataka → **Save**. Hii hai-pushi Omada moja kwa moja; inahifadhi muonekano wa `/portal/{brandSlug}`.

3. **SSID ya Wi‑Fi ya wateja**  
   Nenda **SSIDs** → unda SSID **bila password** (open) kwa site sahihi.  
   - Ikiwa Omada imeunganishwa vizuri, SSID inaweza kuonekana kama `pushedToOmada` / `omadaSsidId` kwenye majibu.  
   - **Baada ya deploy ya code ya hivi karibuni**, kuunda SSID wazi mara nyingi inajaribu tena kuambatanisha portal kwenye Omada kiotomatiki.

4. **Push tena portal URL + kuambatanisha SSID kwenye Omada (API)**  
   Hii inahitaji **toleo la app** linalo endpoint `POST /api/v1/reseller/omada/sync-portal`.  
   - **Njia 1 — DevTools (rahisi):** fungua dashboard ya reseller → **F12 → Network** → kwenye tab ingine u fungua Console uandike (au tumia “Copy as cURL” baada ya ombi lolote linalo `Authorization: Bearer`):  
     - Omba `POST /api/v1/reseller/omada/sync-portal` na mwili `{}` (sync sites zote zenye Omada) au `{"siteId":"<id ya site>"}` kwa site moja.  
   - **Njia 2 — Terminal:** (badilisha `TOKEN` na token kutoka login)  
     `curl -sS -X POST "https://ssdomada.site/api/v1/reseller/omada/sync-portal" -H "Authorization: Bearer TOKEN" -H "Content-Type: application/json" -d "{}"`  
   - Angalia majibu: `sites[].sync.ok`, `portalUrl`, na `openSsidNames` — lazima ziendane na SSID zako **wazi** zilizo na `omadaSsidId`.

5. **URL ya umma (mazingira ya server)** — jukumu la admin / deploy  
   `NEXT_PUBLIC_APP_URL` (au `OMADA_PORTAL_PUBLIC_BASE_URL`) lazima iwe **HTTPS** halisi inayofikiwa na controller na simu (mfano `https://ssdomada.site`). Hii ndiyo msingi wa **External Portal URL** inayotumwa Omada.

### Sehemu B — Omada Controller (mkono — pre-authentication)

6. **Ingia Omada Controller** (URL ya controller yenu, mfano `https://server...`).

7. **Chagua site sahihi**  
   Lazima iwe **ile site** inayolingana na SSDomada (sawia na `omadaSiteId` ya site yako).

8. **Weka / thibitisha External Portal**  
   **Settings → Authentication → Portal** (au mahali panapoitwa “Hotspot / Portal” kulingana na toleo):  
   - Aina: **External Portal** / **External RADIUS** kama ilivyowekwa na SSDomada.  
   - **External Portal URL** inapaswa kuwa kama `https://…/portal/{brandSlug}` (sawa na `portalUrl` kutoka sync).  
   - Thibitisha portal imeambatanishwa na **SSID** / wireless network sahihi (kwa UI ya Omada).

9. **Pre-Authentication Access (hapa ndipo “Google / Apple / Microsoft”)**  
   - Nenda **Portal** → **Access Control** / **Pre-Authentication Access** (jina linatofautiana na toleo la Omada).  
   - Ongeza **URL au hostname** kwa kila moja inayohitajika **kabla** ya mteja kumaliza login (angalia jedwali “Suggested hostname allowlist” hapo juu).  
   - **Hakikisha** umeongeza: domain ya app yako (`ssdomada.site`), na host ya **Snippe** (kutoka `SNIPPE_API_URL`), pamoja na `captive.apple.com`, `connectivitycheck.gstatic.com`, `clients3.google.com`, `www.msftconnecttest.com`, `dns.msftncsi.com`, nk. kama orodha ya juu.  
   - Hii hatua **haiwezi** kwa sasa kufanywa peke yake kutoka SSDomada bila API ya wazi ya Omada — **lazima mkono** kwenye controller.

10. **Hifadhi** mipangilio ya Omada na subiri provisioning (kadri ya controller).

### Sehemu C — kuthibitisha

11. **Simu** — unganisha Wi‑Fi ya SSID wazi → inapaswa kuonyesha **sign-in / captive** au kufungua portal.  
12. **Jaribu malipo** (ikiwa kuna package) — ikiwa Snippe haifunguki, ongeza host zinazokosekana kwenye pre-auth.  
13. **Rudia sync** ikiwa umeongeza SSID mpya wazi baadaye: tena `POST …/omada/sync-portal`.

### Tatizo la kawaida

- **Portal haionekani / hakuna “Sign in to network”:** ongeza / sahihisha **Pre-Authentication Access** (hatua 9).  
- **Portal haifunguki kabisa:** angalia **External URL** na HTTPS + `NEXT_PUBLIC_APP_URL`.  
- **SSID haipo kwenye portal Omada:** endesha **sync-portal** (hatua 4) au angalia SSID ni **open** na iko na `omadaSsidId` kwenye SSDomada.
