-- CreateEnum
CREATE TYPE "ResellerPlanStatus" AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ResellerPlanInterval" AS ENUM ('MONTHLY', 'YEARLY', 'LIFETIME');

-- CreateTable
CREATE TABLE "reseller_plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "price" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'TZS',
    "interval" "ResellerPlanInterval" NOT NULL DEFAULT 'MONTHLY',
    "trialDays" INTEGER NOT NULL DEFAULT 0,
    "maxSites" INTEGER,
    "maxDevices" INTEGER,
    "maxActiveClients" INTEGER,
    "maxStaff" INTEGER,
    "customBranding" BOOLEAN NOT NULL DEFAULT false,
    "customDomain" BOOLEAN NOT NULL DEFAULT false,
    "smsNotifications" BOOLEAN NOT NULL DEFAULT false,
    "prioritySupport" BOOLEAN NOT NULL DEFAULT false,
    "apiAccess" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "reseller_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reseller_plan_subscriptions" (
    "id" TEXT NOT NULL,
    "resellerId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "ResellerPlanStatus" NOT NULL DEFAULT 'TRIAL',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "trialEndsAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "lastPaymentRef" TEXT,
    "lastPaymentAt" TIMESTAMP(3),
    "snapshotJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "reseller_plan_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reseller_plans_name_key" ON "reseller_plans"("name");
CREATE UNIQUE INDEX "reseller_plans_slug_key" ON "reseller_plans"("slug");
CREATE UNIQUE INDEX "reseller_plan_subscriptions_resellerId_key" ON "reseller_plan_subscriptions"("resellerId");
CREATE INDEX "reseller_plan_subscriptions_status_idx" ON "reseller_plan_subscriptions"("status");
CREATE INDEX "reseller_plan_subscriptions_currentPeriodEnd_idx" ON "reseller_plan_subscriptions"("currentPeriodEnd");

-- AddForeignKey
ALTER TABLE "reseller_plan_subscriptions" ADD CONSTRAINT "reseller_plan_subscriptions_resellerId_fkey" FOREIGN KEY ("resellerId") REFERENCES "resellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reseller_plan_subscriptions" ADD CONSTRAINT "reseller_plan_subscriptions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "reseller_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
