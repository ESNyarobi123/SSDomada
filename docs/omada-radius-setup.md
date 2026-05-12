# Omada Controller — RADIUS Profile + Captive Portal Setup

## Prerequisites
- FreeRADIUS running on server ✅
- PostgreSQL with radcheck/radreply tables ✅
- Omada Controller accessible at https://server.ssdomada.site ✅

---

## Step 1: Create RADIUS Profile

1. Open **https://server.ssdomada.site**
2. Go to the site: Click **SSDomada_Controller** (or your site name)
3. Navigate to: **Settings** → **Authentication** → **RADIUS Profile**
4. Click **"+ Create New RADIUS Profile"**
5. Fill in:

| Field | Value |
|---|---|
| **Profile Name** | `SSDomada-RADIUS` |
| **Authentication Server** | |
| - IP Address | `127.0.0.1` |
| - Port | `1812` |
| - Secret | `SSDomada2026SecureR@dius` |
| **Accounting Server** | ✅ Enable |
| - IP Address | `127.0.0.1` |
| - Port | `1813` |
| - Secret | `SSDomada2026SecureR@dius` |

6. Click **Save**

---

## Step 2: Create Captive Portal (Hotspot)

1. Navigate to: **Settings** → **Authentication** → **Portal**
2. Click **"+ Create New Portal"**
3. Fill in:

| Field | Value |
|---|---|
| **Portal Name** | `SSDomada-Portal` |
| **Authentication Type** | `External RADIUS Server` |
| **RADIUS Profile** | Select `SSDomada-RADIUS` (created above) |
| **Portal Customization** | `External Portal Server` |
| **External Portal URL** | `https://app.ssdomada.site/portal/fastnet` |
| **Redirect** | ✅ Enable (redirect after login) |
| **Redirect URL** | `https://app.ssdomada.site/portal/fastnet/success` |
| **Portal Authentication Type** | `Simple Password` or `Hotspot` |
| **Landing Page** | Optional |

> **Note:** The External Portal URL should point to your deployed SSDomada app.
> For testing, you can use a temporary URL or the server's IP.

4. Click **Save**

---

## Step 3: Apply Portal to SSID (WiFi Network)

1. Navigate to: **Settings** → **Wireless Networks**
2. Either **edit existing SSID** or click **"+ Create New Wireless Network"**
3. Fill in:

| Field | Value |
|---|---|
| **SSID Name** | `FastNet WiFi` (or any name) |
| **Security** | `Open` (portal handles auth) |
| **Band** | `2.4 GHz & 5 GHz` |
| **Portal** | ✅ Enable |
| **Portal Profile** | Select `SSDomada-Portal` |
| **VLAN** | Optional |

4. Click **Save**

---

## Step 4: Test the Flow

### Quick RADIUS Test (from server terminal):
```bash
# Insert temp test user
sudo -u postgres psql -d ssdomada -c "INSERT INTO radcheck (username, attribute, op, value) VALUES ('test-mac', 'Cleartext-Password', ':=', 'test-mac');"

# Test authentication
radtest "test-mac" "test-mac" 127.0.0.1 0 "SSDomada2026SecureR@dius"

# Expected: Access-Accept

# Cleanup
sudo -u postgres psql -d ssdomada -c "DELETE FROM radcheck WHERE username='test-mac';"
```

### Full Flow Test:
1. Connect phone/laptop to `FastNet WiFi`
2. Browser should redirect to captive portal
3. Select a package → Pay via Snippe
4. Payment webhook creates RADIUS credentials in radcheck/radreply
5. FreeRADIUS authenticates → Access-Accept
6. Client gets internet access with session timeout + bandwidth limits

---

## Expected Portal Redirect URL Parameters

When Omada redirects to the external portal, the URL will include:

```
https://app.ssdomada.site/portal/fastnet
  ?clientMac=AA-BB-CC-DD-EE-FF    # Client MAC address
  &apMac=11-22-33-44-55-66        # Access Point MAC
  &ssid=FastNet%20WiFi             # SSID name
  &radioId=0                       # Radio band
  &url=http://original-url.com     # URL client was visiting
  &t=1234567890                    # Timestamp
```

The SSDomada captive portal API (`GET /api/portal/fastnet`) reads these parameters 
and creates a PortalSession for tracking.

---

## Troubleshooting

### FreeRADIUS not responding
```bash
# Check status
systemctl status freeradius

# Test in debug mode
systemctl stop freeradius
freeradius -X
# (then test with radtest in another terminal)
```

### Access-Reject (auth failed)
```bash
# Check radcheck has the user
sudo -u postgres psql -d ssdomada -c "SELECT * FROM radcheck WHERE username='AA-BB-CC-DD-EE-FF';"

# Check format: attribute should be 'Cleartext-Password', op should be ':='
```

### Portal not redirecting
- Ensure SSID has Portal enabled
- Ensure Portal Authentication Type matches (RADIUS)
- Check client is not already authenticated
- Try clearing browser cache / incognito mode

### RADIUS Secret mismatch
- Omada secret MUST match FreeRADIUS clients.conf secret
- Current secret: `SSDomada2026SecureR@dius`
