# FreeRADIUS + SSDomada Integration Guide

## Overview

SSDomada uses **FreeRADIUS** with the `rlm_sql_postgresql` module to authenticate
WiFi clients via the TP-Link Omada SDN Controller.

```
Flow:
  Client connects → Omada sends RADIUS Auth Request
  → FreeRADIUS queries radcheck (PostgreSQL)
  → If match: Access-Accept + Session-Timeout + Bandwidth from radreply
  → Client gets WiFi access
  → FreeRADIUS writes accounting to radacct
```

## 1. Install FreeRADIUS + PostgreSQL Module

```bash
# Ubuntu / Debian
sudo apt-get update
sudo apt-get install freeradius freeradius-postgresql

# CentOS / RHEL
sudo yum install freeradius freeradius-postgresql
```

## 2. Configure SQL Module

Edit `/etc/freeradius/3.0/mods-available/sql`:

```conf
sql {
    driver = "rlm_sql_postgresql"
    dialect = "postgresql"

    server = "localhost"
    port = 5432
    login = "ssdomada"
    password = "YOUR_DB_PASSWORD"
    radius_db = "ssdomada"

    # Read clients from SQL
    read_clients = yes
    client_table = "nas"

    # Schema
    accounting {
        reference = "%{tolower:type.%{Acct-Status-Type}.query}"
    }
    post-auth {
        reference = ".query"
    }

    # Custom queries for our Prisma-managed tables
    authorize_check_query = "SELECT id, username, attribute, value, op FROM radcheck WHERE username = '%{SQL-User-Name}' ORDER BY id"

    authorize_reply_query = "SELECT id, username, attribute, value, op FROM radreply WHERE username = '%{SQL-User-Name}' ORDER BY id"

    authorize_group_check_query = "SELECT id, groupname, attribute, value, op FROM radgroupcheck WHERE groupname = '%{${group_attribute}}' ORDER BY id"

    authorize_group_reply_query = "SELECT id, groupname, attribute, value, op FROM radgroupreply WHERE groupname = '%{${group_attribute}}' ORDER BY id"

    group_membership_query = "SELECT groupname FROM radusergroup WHERE username = '%{SQL-User-Name}' ORDER BY priority"

    # Accounting queries
    accounting_onoff_query = ""

    accounting_update_query = "\
        UPDATE radacct \
        SET \
            acctupdatetime  = now(), \
            acctinterval    = '%{%{Acct-Delay-Time}:-0}'::integer + '%{Acct-Session-Time}'::integer - acctsessiontime, \
            acctsessiontime = '%{Acct-Session-Time}'::integer, \
            acctinputoctets = '%{Acct-Input-Octets}'::bigint + ('%{%{Acct-Input-Gigawords}:-0}'::bigint * 4294967296), \
            acctoutputoctets = '%{Acct-Output-Octets}'::bigint + ('%{%{Acct-Output-Gigawords}:-0}'::bigint * 4294967296), \
            framedipaddress = '%{Framed-IP-Address}' \
        WHERE acctuniqueid = '%{Acct-Unique-Session-Id}'"

    accounting_update_query_alt = "\
        INSERT INTO radacct \
            (acctsessionid, acctuniqueid, username, realm, \
            nasipaddress, nasportid, nasporttype, \
            acctstarttime, acctupdatetime, acctsessiontime, \
            acctinputoctets, acctoutputoctets, \
            calledstationid, callingstationid, \
            servicetype, framedprotocol, framedipaddress) \
        VALUES \
            ('%{Acct-Session-Id}', '%{Acct-Unique-Session-Id}', '%{SQL-User-Name}', '%{Realm}', \
            '%{NAS-IP-Address}', '%{%{NAS-Port-Id}:-}', '%{NAS-Port-Type}', \
            (now() - '%{Acct-Session-Time}'::integer * interval '1 second'), now(), '%{Acct-Session-Time}'::integer, \
            '%{Acct-Input-Octets}'::bigint + ('%{%{Acct-Input-Gigawords}:-0}'::bigint * 4294967296), \
            '%{Acct-Output-Octets}'::bigint + ('%{%{Acct-Output-Gigawords}:-0}'::bigint * 4294967296), \
            '%{Called-Station-Id}', '%{Calling-Station-Id}', \
            '%{Service-Type}', '%{Framed-Protocol}', '%{Framed-IP-Address}')"

    accounting_start_query = "\
        INSERT INTO radacct \
            (acctsessionid, acctuniqueid, username, realm, \
            nasipaddress, nasportid, nasporttype, \
            acctstarttime, acctupdatetime, \
            calledstationid, callingstationid, \
            servicetype, framedprotocol, framedipaddress) \
        VALUES \
            ('%{Acct-Session-Id}', '%{Acct-Unique-Session-Id}', '%{SQL-User-Name}', '%{Realm}', \
            '%{NAS-IP-Address}', '%{%{NAS-Port-Id}:-}', '%{NAS-Port-Type}', \
            now(), now(), \
            '%{Called-Station-Id}', '%{Calling-Station-Id}', \
            '%{Service-Type}', '%{Framed-Protocol}', '%{Framed-IP-Address}')"

    accounting_stop_query = "\
        UPDATE radacct \
        SET \
            acctstoptime    = now(), \
            acctsessiontime = '%{Acct-Session-Time}'::integer, \
            acctinputoctets = '%{Acct-Input-Octets}'::bigint + ('%{%{Acct-Input-Gigawords}:-0}'::bigint * 4294967296), \
            acctoutputoctets = '%{Acct-Output-Octets}'::bigint + ('%{%{Acct-Output-Gigawords}:-0}'::bigint * 4294967296), \
            acctterminatecause = '%{Acct-Terminate-Cause}', \
            framedipaddress = '%{Framed-IP-Address}', \
            connectinfo_stop = '%{Connect-Info}' \
        WHERE acctuniqueid = '%{Acct-Unique-Session-Id}'"

    # Post-auth logging
    post-auth {
        query = "\
            INSERT INTO radpostauth \
                (username, pass, reply, authdate, calledstationid, callingstationid) \
            VALUES \
                ('%{User-Name}', '%{%{User-Password}:-%{Chap-Password}}', '%{reply:Packet-Type}', \
                now(), '%{Called-Station-Id}', '%{Calling-Station-Id}')"
    }
}
```

## 3. Enable SQL Module

```bash
cd /etc/freeradius/3.0/mods-enabled
sudo ln -sf ../mods-available/sql sql
```

## 4. Configure Default Site

Edit `/etc/freeradius/3.0/sites-available/default`:

```conf
server default {
    listen {
        type = auth
        ipaddr = *
        port = 1812
    }

    listen {
        type = acct
        ipaddr = *
        port = 1813
    }

    authorize {
        filter_username
        preprocess
        sql        # ← Read from our PostgreSQL
        expiration # ← Check Expiration attribute from radcheck
        pap
    }

    authenticate {
        Auth-Type PAP {
            pap
        }
    }

    preacct {
        preprocess
    }

    accounting {
        sql        # ← Write accounting to radacct
    }

    post-auth {
        sql        # ← Log auth attempts to radpostauth
    }
}
```

## 5. Configure Omada Controller as RADIUS Client

Edit `/etc/freeradius/3.0/clients.conf`:

```conf
client omada_controller {
    ipaddr = 192.168.0.1/24   # Your Omada Controller IP/subnet
    secret = YOUR_RADIUS_SECRET
    shortname = omada
    nastype = other
}
```

## 6. Configure Omada Controller

In the Omada SDN Controller:

1. Go to **Settings → Authentication → RADIUS Profile**
2. Add new RADIUS Profile:
   - **Auth Server**: Your FreeRADIUS server IP
   - **Auth Port**: 1812
   - **Auth Secret**: Same as in clients.conf
   - **Acct Server**: Your FreeRADIUS server IP
   - **Acct Port**: 1813
   - **Acct Secret**: Same as clients.conf
3. Go to **Settings → Wireless Networks → SSID**
4. Select your captive portal SSID
5. Set **Portal** → **External RADIUS Server**
6. Select the RADIUS Profile you created

## 7. Test

```bash
# Start FreeRADIUS in debug mode
sudo freeradius -X

# Test authentication (from another terminal)
echo "User-Name=AA-BB-CC-DD-EE-FF,User-Password=test123" | radclient -x localhost:1812 auth YOUR_RADIUS_SECRET
```

## 8. Environment Variables (.env)

```env
# FreeRADIUS communicates directly with PostgreSQL
# No extra env vars needed — it reads from the same DB

# Optional: For RADIUS CoA (Change of Authorization) / Disconnect Messages
RADIUS_SECRET=your_shared_secret
RADIUS_NAS_IP=192.168.0.1
```

## 9. Cron Job — Expire Stale Credentials

Add to your crontab or use a scheduler:

```bash
# Every minute: expire stale RADIUS users
* * * * * curl -X POST http://localhost:3000/api/cron/radius-expire -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Or use Next.js middleware/API route with Vercel Cron.

## Architecture Diagram

```
┌──────────────┐     WiFi Connect     ┌──────────────────┐
│   Client     │ ──────────────────→  │  Omada AP        │
│   (Phone)    │                      │  (Captive Portal)│
└──────┬───────┘                      └────────┬─────────┘
       │                                       │
       │  Redirected to Portal                 │ RADIUS Auth Request
       ▼                                       ▼
┌──────────────┐                      ┌──────────────────┐
│  SSDomada    │   Payment Success    │  FreeRADIUS      │
│  Portal UI   │ ──→ Webhook ──→      │  (rlm_sql_pg)    │
│  (Next.js)   │   Create radcheck    │                  │
└──────────────┘                      └────────┬─────────┘
       │                                       │
       │ Snippe Payment                        │ SQL Query
       ▼                                       ▼
┌──────────────┐                      ┌──────────────────┐
│  Snippe      │                      │  PostgreSQL      │
│  Gateway     │                      │  (radcheck,      │
│              │                      │   radreply,      │
└──────────────┘                      │   radacct)       │
                                      └──────────────────┘
```
