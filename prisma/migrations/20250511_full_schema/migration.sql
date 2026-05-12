-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'RESELLER', 'END_USER');

-- CreateEnum
CREATE TYPE "DeviceStatus" AS ENUM ('ONLINE', 'OFFLINE', 'PENDING');

-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('AP', 'SWITCH', 'GATEWAY', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'EXPIRED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('MOBILE', 'CARD', 'SESSION', 'QR');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REVERSED');

-- CreateEnum
CREATE TYPE "PayoutChannel" AS ENUM ('MOBILE', 'BANK');

-- CreateEnum
CREATE TYPE "WithdrawalStatus" AS ENUM ('PENDING', 'APPROVED', 'PROCESSING', 'COMPLETED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "PackageDuration" AS ENUM ('MINUTES_30', 'HOUR_1', 'HOURS_3', 'HOURS_6', 'HOURS_12', 'HOURS_24', 'DAYS_3', 'DAYS_7', 'DAYS_14', 'DAYS_30', 'DAYS_90', 'DAYS_365', 'LIFETIME', 'UNLIMITED');

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "password" TEXT,
    "image" TEXT,
    "phone" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'END_USER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resellers" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "brandSlug" TEXT NOT NULL,
    "logo" TEXT,
    "description" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "omadaSiteId" TEXT,
    "commissionRate" DOUBLE PRECISION NOT NULL DEFAULT 0.10,
    "walletBalance" DOUBLE PRECISION NOT NULL DEFAULT 0.00,
    "totalEarnings" DOUBLE PRECISION NOT NULL DEFAULT 0.00,
    "currency" TEXT NOT NULL DEFAULT 'TZS',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resellers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sites" (
    "id" TEXT NOT NULL,
    "resellerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "omadaSiteId" TEXT,
    "location" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" TEXT NOT NULL,
    "resellerId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "mac" TEXT NOT NULL,
    "model" TEXT,
    "type" "DeviceType" NOT NULL DEFAULT 'AP',
    "status" "DeviceStatus" NOT NULL DEFAULT 'PENDING',
    "ip" TEXT,
    "omadaDeviceId" TEXT,
    "firmwareVersion" TEXT,
    "lastSeen" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "packages" (
    "id" TEXT NOT NULL,
    "resellerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TZS',
    "duration" "PackageDuration" NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "dataLimitMb" INTEGER,
    "speedLimitUp" INTEGER,
    "speedLimitDown" INTEGER,
    "maxDevices" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "dataUsedMb" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wifi_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "clientMac" TEXT NOT NULL,
    "clientIp" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "dataUpMb" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dataDownMb" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "wifi_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "snippeReference" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resellerId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TZS',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paymentType" "PaymentType" NOT NULL,
    "customerPhone" TEXT,
    "customerEmail" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "metadata" JSONB,
    "completedAt" TIMESTAMP(3),
    "platformFee" INTEGER NOT NULL DEFAULT 0,
    "resellerAmount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payouts" (
    "id" TEXT NOT NULL,
    "snippeReference" TEXT NOT NULL,
    "resellerId" TEXT NOT NULL,
    "withdrawalId" TEXT,
    "amount" INTEGER NOT NULL,
    "fee" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL,
    "channel" "PayoutChannel" NOT NULL,
    "recipientPhone" TEXT,
    "recipientAccount" TEXT,
    "recipientBank" TEXT,
    "recipientName" TEXT NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'PENDING',
    "narration" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "metadata" JSONB,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "withdrawals" (
    "id" TEXT NOT NULL,
    "resellerId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TZS',
    "status" "WithdrawalStatus" NOT NULL DEFAULT 'PENDING',
    "channel" "PayoutChannel" NOT NULL,
    "recipientPhone" TEXT,
    "recipientAccount" TEXT,
    "recipientBank" TEXT,
    "recipientName" TEXT NOT NULL,
    "adminNote" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "withdrawals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "captive_portal_configs" (
    "id" TEXT NOT NULL,
    "resellerId" TEXT NOT NULL,
    "logo" TEXT,
    "bgImage" TEXT,
    "bgColor" TEXT NOT NULL DEFAULT '#ffffff',
    "primaryColor" TEXT NOT NULL DEFAULT '#0070f3',
    "accentColor" TEXT NOT NULL DEFAULT '#00c853',
    "companyName" TEXT,
    "welcomeText" TEXT DEFAULT 'Welcome! Connect to WiFi',
    "termsUrl" TEXT,
    "termsText" TEXT,
    "customCss" TEXT,
    "customHtml" TEXT,
    "template" TEXT NOT NULL DEFAULT 'default',
    "redirectUrl" TEXT,
    "showLogo" BOOLEAN NOT NULL DEFAULT true,
    "showSocial" BOOLEAN NOT NULL DEFAULT false,
    "socialLinks" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "captive_portal_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vouchers" (
    "id" TEXT NOT NULL,
    "resellerId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "usedById" TEXT,
    "usedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vouchers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blocked_macs" (
    "id" TEXT NOT NULL,
    "resellerId" TEXT NOT NULL,
    "mac" TEXT NOT NULL,
    "reason" TEXT,
    "blockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blocked_macs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ssid_configs" (
    "id" TEXT NOT NULL,
    "resellerId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "ssidName" TEXT NOT NULL,
    "password" TEXT,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "band" TEXT NOT NULL DEFAULT '2.4GHz',
    "vlanId" INTEGER,
    "omadaSsidId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ssid_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "resellerId" TEXT NOT NULL,
    "emailOnPayment" BOOLEAN NOT NULL DEFAULT true,
    "emailOnWithdrawal" BOOLEAN NOT NULL DEFAULT true,
    "emailOnNewClient" BOOLEAN NOT NULL DEFAULT false,
    "emailOnDeviceDown" BOOLEAN NOT NULL DEFAULT true,
    "smsOnPayment" BOOLEAN NOT NULL DEFAULT false,
    "smsOnWithdrawal" BOOLEAN NOT NULL DEFAULT true,
    "smsOnDeviceDown" BOOLEAN NOT NULL DEFAULT false,
    "emailAddress" TEXT,
    "smsPhone" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "radcheck" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "attribute" TEXT NOT NULL,
    "op" TEXT NOT NULL DEFAULT ':=',
    "value" TEXT NOT NULL,

    CONSTRAINT "radcheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "radreply" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "attribute" TEXT NOT NULL,
    "op" TEXT NOT NULL DEFAULT ':=',
    "value" TEXT NOT NULL,

    CONSTRAINT "radreply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "radgroupcheck" (
    "id" SERIAL NOT NULL,
    "groupname" TEXT NOT NULL,
    "attribute" TEXT NOT NULL,
    "op" TEXT NOT NULL DEFAULT ':=',
    "value" TEXT NOT NULL,

    CONSTRAINT "radgroupcheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "radgroupreply" (
    "id" SERIAL NOT NULL,
    "groupname" TEXT NOT NULL,
    "attribute" TEXT NOT NULL,
    "op" TEXT NOT NULL DEFAULT ':=',
    "value" TEXT NOT NULL,

    CONSTRAINT "radgroupreply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "radusergroup" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "groupname" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "radusergroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "radacct" (
    "radacctid" BIGSERIAL NOT NULL,
    "acctsessionid" TEXT NOT NULL DEFAULT '',
    "acctuniqueid" TEXT NOT NULL DEFAULT '',
    "username" TEXT NOT NULL DEFAULT '',
    "realm" TEXT NOT NULL DEFAULT '',
    "nasipaddress" TEXT NOT NULL DEFAULT '',
    "nasportid" TEXT,
    "nasporttype" TEXT,
    "acctstarttime" TIMESTAMP(3),
    "acctupdatetime" TIMESTAMP(3),
    "acctstoptime" TIMESTAMP(3),
    "acctinterval" INTEGER,
    "acctsessiontime" INTEGER,
    "acctauthentic" TEXT,
    "connectinfo_start" TEXT,
    "connectinfo_stop" TEXT,
    "acctinputoctets" BIGINT NOT NULL DEFAULT 0,
    "acctoutputoctets" BIGINT NOT NULL DEFAULT 0,
    "calledstationid" TEXT NOT NULL DEFAULT '',
    "callingstationid" TEXT NOT NULL DEFAULT '',
    "acctterminatecause" TEXT NOT NULL DEFAULT '',
    "servicetype" TEXT,
    "framedprotocol" TEXT,
    "framedipaddress" TEXT NOT NULL DEFAULT '',
    "framedipv6address" TEXT NOT NULL DEFAULT '',
    "framedipv6prefix" TEXT NOT NULL DEFAULT '',
    "framedinterfaceid" TEXT NOT NULL DEFAULT '',
    "delegatedipv6prefix" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "radacct_pkey" PRIMARY KEY ("radacctid")
);

-- CreateTable
CREATE TABLE "radpostauth" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL DEFAULT '',
    "pass" TEXT NOT NULL DEFAULT '',
    "reply" TEXT NOT NULL DEFAULT '',
    "authdate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "calledstationid" TEXT NOT NULL DEFAULT '',
    "callingstationid" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "radpostauth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "radius_users" (
    "id" TEXT NOT NULL,
    "resellerId" TEXT NOT NULL,
    "userId" TEXT,
    "subscriptionId" TEXT,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "macAddress" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "sessionTimeout" INTEGER NOT NULL,
    "dataLimitBytes" BIGINT,
    "bandwidthUp" INTEGER,
    "bandwidthDown" INTEGER,
    "maxSessions" INTEGER NOT NULL DEFAULT 1,
    "authMethod" TEXT NOT NULL DEFAULT 'MAC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "radius_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portal_sessions" (
    "id" TEXT NOT NULL,
    "resellerId" TEXT NOT NULL,
    "clientMac" TEXT NOT NULL,
    "clientIp" TEXT,
    "apMac" TEXT,
    "ssid" TEXT,
    "nasId" TEXT,
    "redirectUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "packageId" TEXT,
    "paymentId" TEXT,
    "radiusUserId" TEXT,
    "authorizedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portal_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT,
    "entityId" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'string',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "resellers_userId_key" ON "resellers"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "resellers_brandSlug_key" ON "resellers"("brandSlug");

-- CreateIndex
CREATE UNIQUE INDEX "resellers_omadaSiteId_key" ON "resellers"("omadaSiteId");

-- CreateIndex
CREATE UNIQUE INDEX "sites_omadaSiteId_key" ON "sites"("omadaSiteId");

-- CreateIndex
CREATE UNIQUE INDEX "devices_mac_key" ON "devices"("mac");

-- CreateIndex
CREATE UNIQUE INDEX "payments_snippeReference_key" ON "payments"("snippeReference");

-- CreateIndex
CREATE UNIQUE INDEX "payments_subscriptionId_key" ON "payments"("subscriptionId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_idempotencyKey_key" ON "payments"("idempotencyKey");

-- CreateIndex
CREATE INDEX "payments_resellerId_idx" ON "payments"("resellerId");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE UNIQUE INDEX "payouts_snippeReference_key" ON "payouts"("snippeReference");

-- CreateIndex
CREATE UNIQUE INDEX "payouts_withdrawalId_key" ON "payouts"("withdrawalId");

-- CreateIndex
CREATE UNIQUE INDEX "payouts_idempotencyKey_key" ON "payouts"("idempotencyKey");

-- CreateIndex
CREATE INDEX "payouts_resellerId_idx" ON "payouts"("resellerId");

-- CreateIndex
CREATE INDEX "payouts_status_idx" ON "payouts"("status");

-- CreateIndex
CREATE INDEX "withdrawals_resellerId_idx" ON "withdrawals"("resellerId");

-- CreateIndex
CREATE INDEX "withdrawals_status_idx" ON "withdrawals"("status");

-- CreateIndex
CREATE UNIQUE INDEX "captive_portal_configs_resellerId_key" ON "captive_portal_configs"("resellerId");

-- CreateIndex
CREATE UNIQUE INDEX "vouchers_code_key" ON "vouchers"("code");

-- CreateIndex
CREATE INDEX "vouchers_resellerId_idx" ON "vouchers"("resellerId");

-- CreateIndex
CREATE INDEX "vouchers_code_idx" ON "vouchers"("code");

-- CreateIndex
CREATE UNIQUE INDEX "blocked_macs_resellerId_mac_key" ON "blocked_macs"("resellerId", "mac");

-- CreateIndex
CREATE INDEX "ssid_configs_resellerId_idx" ON "ssid_configs"("resellerId");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_resellerId_key" ON "notification_preferences"("resellerId");

-- CreateIndex
CREATE INDEX "radcheck_username_idx" ON "radcheck"("username");

-- CreateIndex
CREATE INDEX "radreply_username_idx" ON "radreply"("username");

-- CreateIndex
CREATE INDEX "radgroupcheck_groupname_idx" ON "radgroupcheck"("groupname");

-- CreateIndex
CREATE INDEX "radgroupreply_groupname_idx" ON "radgroupreply"("groupname");

-- CreateIndex
CREATE INDEX "radusergroup_username_idx" ON "radusergroup"("username");

-- CreateIndex
CREATE UNIQUE INDEX "radacct_acctuniqueid_key" ON "radacct"("acctuniqueid");

-- CreateIndex
CREATE INDEX "radacct_username_idx" ON "radacct"("username");

-- CreateIndex
CREATE INDEX "radacct_acctsessionid_idx" ON "radacct"("acctsessionid");

-- CreateIndex
CREATE INDEX "radacct_acctstarttime_idx" ON "radacct"("acctstarttime");

-- CreateIndex
CREATE INDEX "radacct_acctstoptime_idx" ON "radacct"("acctstoptime");

-- CreateIndex
CREATE INDEX "radacct_nasipaddress_idx" ON "radacct"("nasipaddress");

-- CreateIndex
CREATE INDEX "radacct_callingstationid_idx" ON "radacct"("callingstationid");

-- CreateIndex
CREATE INDEX "radpostauth_username_idx" ON "radpostauth"("username");

-- CreateIndex
CREATE INDEX "radpostauth_authdate_idx" ON "radpostauth"("authdate");

-- CreateIndex
CREATE UNIQUE INDEX "radius_users_username_key" ON "radius_users"("username");

-- CreateIndex
CREATE INDEX "radius_users_resellerId_idx" ON "radius_users"("resellerId");

-- CreateIndex
CREATE INDEX "radius_users_macAddress_idx" ON "radius_users"("macAddress");

-- CreateIndex
CREATE INDEX "radius_users_expiresAt_idx" ON "radius_users"("expiresAt");

-- CreateIndex
CREATE INDEX "portal_sessions_clientMac_idx" ON "portal_sessions"("clientMac");

-- CreateIndex
CREATE INDEX "portal_sessions_resellerId_idx" ON "portal_sessions"("resellerId");

-- CreateIndex
CREATE INDEX "portal_sessions_status_idx" ON "portal_sessions"("status");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "system_settings_key_key" ON "system_settings"("key");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resellers" ADD CONSTRAINT "resellers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sites" ADD CONSTRAINT "sites_resellerId_fkey" FOREIGN KEY ("resellerId") REFERENCES "resellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_resellerId_fkey" FOREIGN KEY ("resellerId") REFERENCES "resellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "packages" ADD CONSTRAINT "packages_resellerId_fkey" FOREIGN KEY ("resellerId") REFERENCES "resellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wifi_sessions" ADD CONSTRAINT "wifi_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wifi_sessions" ADD CONSTRAINT "wifi_sessions_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wifi_sessions" ADD CONSTRAINT "wifi_sessions_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_resellerId_fkey" FOREIGN KEY ("resellerId") REFERENCES "resellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_resellerId_fkey" FOREIGN KEY ("resellerId") REFERENCES "resellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_withdrawalId_fkey" FOREIGN KEY ("withdrawalId") REFERENCES "withdrawals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawals" ADD CONSTRAINT "withdrawals_resellerId_fkey" FOREIGN KEY ("resellerId") REFERENCES "resellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "captive_portal_configs" ADD CONSTRAINT "captive_portal_configs_resellerId_fkey" FOREIGN KEY ("resellerId") REFERENCES "resellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_resellerId_fkey" FOREIGN KEY ("resellerId") REFERENCES "resellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_usedById_fkey" FOREIGN KEY ("usedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocked_macs" ADD CONSTRAINT "blocked_macs_resellerId_fkey" FOREIGN KEY ("resellerId") REFERENCES "resellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ssid_configs" ADD CONSTRAINT "ssid_configs_resellerId_fkey" FOREIGN KEY ("resellerId") REFERENCES "resellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ssid_configs" ADD CONSTRAINT "ssid_configs_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_resellerId_fkey" FOREIGN KEY ("resellerId") REFERENCES "resellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "radius_users" ADD CONSTRAINT "radius_users_resellerId_fkey" FOREIGN KEY ("resellerId") REFERENCES "resellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "radius_users" ADD CONSTRAINT "radius_users_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "radius_users" ADD CONSTRAINT "radius_users_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_sessions" ADD CONSTRAINT "portal_sessions_resellerId_fkey" FOREIGN KEY ("resellerId") REFERENCES "resellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

