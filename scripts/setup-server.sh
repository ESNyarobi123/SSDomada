#!/bin/bash
set -e

echo "============================================"
echo "  SSDomada Server Setup"
echo "  PostgreSQL + FreeRADIUS + Node.js"
echo "============================================"
echo ""

# ============================================================
# STEP 1: Install PostgreSQL 16
# ============================================================
echo ">>> Step 1: Installing PostgreSQL 16..."

apt-get update -qq
apt-get install -y postgresql postgresql-contrib > /dev/null 2>&1

# Start and enable PostgreSQL
systemctl enable postgresql
systemctl start postgresql

# Create database and user
sudo -u postgres psql -c "CREATE USER ssdomada WITH PASSWORD 'ssdomada' CREATEDB;" 2>/dev/null || echo "  User ssdomada already exists"
sudo -u postgres psql -c "CREATE DATABASE ssdomada OWNER ssdomada;" 2>/dev/null || echo "  Database ssdomada already exists"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ssdomada TO ssdomada;"

# Allow password auth for local connections
PG_HBA=$(sudo -u postgres psql -t -c "SHOW hba_file;" | xargs)
if ! grep -q "ssdomada" "$PG_HBA" 2>/dev/null; then
  # Add before the first local line
  sed -i '/^local.*all.*all/i local   ssdomada   ssdomada   md5' "$PG_HBA"
  systemctl reload postgresql
fi

# Test connection
sudo -u postgres psql -d ssdomada -c "SELECT 'PostgreSQL OK' AS status;" && echo "✅ PostgreSQL installed and configured"

# ============================================================
# STEP 2: Install FreeRADIUS + PostgreSQL module
# ============================================================
echo ""
echo ">>> Step 2: Installing FreeRADIUS..."

apt-get install -y freeradius freeradius-postgresql freeradius-utils > /dev/null 2>&1

# Stop FreeRADIUS for configuration
systemctl stop freeradius

echo "✅ FreeRADIUS installed"

# ============================================================
# STEP 3: Configure FreeRADIUS SQL module
# ============================================================
echo ""
echo ">>> Step 3: Configuring FreeRADIUS SQL module..."

# Backup original sql config
cp /etc/freeradius/3.0/mods-available/sql /etc/freeradius/3.0/mods-available/sql.bak

# Write SQL module configuration
cat > /etc/freeradius/3.0/mods-available/sql << 'SQLCONF'
sql {
    driver = "rlm_sql_postgresql"
    dialect = "postgresql"

    server = "localhost"
    port = 5432
    login = "ssdomada"
    password = "ssdomada"
    radius_db = "ssdomada"

    read_clients = no

    # Authorize queries
    authorize_check_query = "SELECT id, username, attribute, value, op FROM radcheck WHERE username = '%{SQL-User-Name}' ORDER BY id"
    authorize_reply_query = "SELECT id, username, attribute, value, op FROM radreply WHERE username = '%{SQL-User-Name}' ORDER BY id"
    authorize_group_check_query = "SELECT id, groupname, attribute, value, op FROM radgroupcheck WHERE groupname = '%{${group_attribute}}' ORDER BY id"
    authorize_group_reply_query = "SELECT id, groupname, attribute, value, op FROM radgroupreply WHERE groupname = '%{${group_attribute}}' ORDER BY id"
    group_membership_query = "SELECT groupname FROM radusergroup WHERE username = '%{SQL-User-Name}' ORDER BY priority"

    # Accounting queries
    accounting {
        reference = "%{tolower:type.%{Acct-Status-Type}.query}"
    }

    accounting_onoff_query = ""

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

    accounting_update_query = "\
        UPDATE radacct \
        SET \
            acctupdatetime  = now(), \
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

    accounting_stop_query = "\
        UPDATE radacct \
        SET \
            acctstoptime    = now(), \
            acctsessiontime = '%{Acct-Session-Time}'::integer, \
            acctinputoctets = '%{Acct-Input-Octets}'::bigint + ('%{%{Acct-Input-Gigawords}:-0}'::bigint * 4294967296), \
            acctoutputoctets = '%{Acct-Output-Octets}'::bigint + ('%{%{Acct-Output-Gigawords}:-0}'::bigint * 4294967296), \
            acctterminatecause = '%{Acct-Terminate-Cause}', \
            framedipaddress = '%{Framed-IP-Address}' \
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
SQLCONF

# Enable SQL module
ln -sf /etc/freeradius/3.0/mods-available/sql /etc/freeradius/3.0/mods-enabled/sql

echo "✅ SQL module configured"

# ============================================================
# STEP 4: Configure FreeRADIUS default site
# ============================================================
echo ""
echo ">>> Step 4: Configuring FreeRADIUS default site..."

# Backup original
cp /etc/freeradius/3.0/sites-available/default /etc/freeradius/3.0/sites-available/default.bak

cat > /etc/freeradius/3.0/sites-available/default << 'SITECONF'
server default {
    listen {
        type = auth
        ipaddr = *
        port = 0
    }

    listen {
        type = acct
        ipaddr = *
        port = 0
    }

    authorize {
        filter_username
        preprocess
        sql
        expiration
        pap
    }

    authenticate {
        Auth-Type PAP {
            pap
        }
        Auth-Type CHAP {
            chap
        }
        Auth-Type MS-CHAP {
            mschap
        }
    }

    preacct {
        preprocess
        acct_unique
    }

    accounting {
        sql
    }

    post-auth {
        sql
        Post-Auth-Type REJECT {
            sql
        }
    }
}
SITECONF

echo "✅ Default site configured"

# ============================================================
# STEP 5: Configure Omada as RADIUS client
# ============================================================
echo ""
echo ">>> Step 5: Adding Omada as RADIUS client..."

RADIUS_SECRET="SSDomada2026SecureR@dius"

# Backup and update clients.conf
cp /etc/freeradius/3.0/clients.conf /etc/freeradius/3.0/clients.conf.bak

# Check if omada client already exists
if ! grep -q "client omada" /etc/freeradius/3.0/clients.conf; then
cat >> /etc/freeradius/3.0/clients.conf << EOF

# TP-Link Omada Controller (localhost since on same server)
client omada_local {
    ipaddr = 127.0.0.1
    secret = ${RADIUS_SECRET}
    shortname = omada-local
    nastype = other
}

# Omada Controller (all local network)
client omada_network {
    ipaddr = 0.0.0.0/0
    secret = ${RADIUS_SECRET}
    shortname = omada
    nastype = other
}
EOF
fi

echo "✅ RADIUS clients configured (secret: ${RADIUS_SECRET})"

# ============================================================
# STEP 6: Set permissions and start FreeRADIUS
# ============================================================
echo ""
echo ">>> Step 6: Setting permissions and starting FreeRADIUS..."

# FreeRADIUS runs as freerad user — grant DB access
sudo -u postgres psql -d ssdomada -c "GRANT SELECT ON radcheck, radreply, radgroupcheck, radgroupreply, radusergroup TO ssdomada;"
sudo -u postgres psql -d ssdomada -c "GRANT SELECT, INSERT, UPDATE ON radacct, radpostauth TO ssdomada;"
sudo -u postgres psql -d ssdomada -c "GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ssdomada;"

# Allow FreeRADIUS through UFW
ufw allow 1812/udp comment 'RADIUS Auth' > /dev/null 2>&1
ufw allow 1813/udp comment 'RADIUS Accounting' > /dev/null 2>&1

# Test FreeRADIUS config
echo "Testing FreeRADIUS configuration..."
freeradius -XC 2>&1 | tail -3

# Enable and start
systemctl enable freeradius
systemctl start freeradius

echo "✅ FreeRADIUS started"

# ============================================================
# STEP 7: Install Node.js 20 (for deploying app later)
# ============================================================
echo ""
echo ">>> Step 7: Installing Node.js 20..."

if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - > /dev/null 2>&1
    apt-get install -y nodejs > /dev/null 2>&1
fi

echo "Node.js: $(node -v 2>/dev/null || echo 'not installed')"
echo "npm: $(npm -v 2>/dev/null || echo 'not installed')"

# ============================================================
# STEP 8: Run Prisma migration on server DB
# ============================================================
echo ""
echo ">>> Step 8: Database schema ready for Prisma migration"
echo "  Run on your local machine:"
echo "  DATABASE_URL=\"postgresql://ssdomada:ssdomada@server.ssdomada.site:5432/ssdomada\" npx prisma migrate deploy"
echo ""
echo "  Or deploy the app to this server and run: npx prisma migrate deploy"

# ============================================================
# FINAL SUMMARY
# ============================================================
echo ""
echo "============================================"
echo "  ✅ Server Setup Complete!"
echo "============================================"
echo ""
echo "PostgreSQL:  $(psql --version 2>/dev/null | head -1)"
echo "FreeRADIUS:  $(freeradius -v 2>&1 | head -1)"
echo "Node.js:     $(node -v 2>/dev/null || echo 'N/A')"
echo ""
echo "RADIUS Secret: ${RADIUS_SECRET}"
echo "DB User:       ssdomada"
echo "DB Password:   ssdomada"
echo "DB Name:       ssdomada"
echo ""
echo "=== Omada Controller RADIUS Setup ==="
echo "Auth Server:   127.0.0.1 (or this server's IP)"
echo "Auth Port:     1812"
echo "Auth Secret:   ${RADIUS_SECRET}"
echo "Acct Server:   127.0.0.1"
echo "Acct Port:     1813"
echo "Acct Secret:   ${RADIUS_SECRET}"
echo ""
echo "=== Next Steps ==="
echo "1. Open PostgreSQL to remote (for migration):"
echo "   Edit /etc/postgresql/*/main/postgresql.conf → listen_addresses = '*'"
echo "   Edit /etc/postgresql/*/main/pg_hba.conf → add your IP"
echo "   OR deploy app to this server directly"
echo ""
echo "2. Configure Omada RADIUS Profile:"
echo "   Settings → Authentication → RADIUS Profile → Add"
echo "   Use the RADIUS details above"
echo ""
echo "3. Test RADIUS:"
echo "   echo 'User-Name=TEST,User-Password=test123' | radclient localhost:1812 auth ${RADIUS_SECRET}"
echo "============================================"
