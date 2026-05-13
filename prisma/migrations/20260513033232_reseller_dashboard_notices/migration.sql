-- CreateTable
CREATE TABLE "reseller_dashboard_notices" (
    "id" TEXT NOT NULL,
    "resellerId" TEXT NOT NULL,
    "title" TEXT,
    "body" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "dismissedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reseller_dashboard_notices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reseller_dashboard_notices_resellerId_dismissedAt_idx" ON "reseller_dashboard_notices"("resellerId", "dismissedAt");

-- AddForeignKey
ALTER TABLE "reseller_dashboard_notices" ADD CONSTRAINT "reseller_dashboard_notices_resellerId_fkey" FOREIGN KEY ("resellerId") REFERENCES "resellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
