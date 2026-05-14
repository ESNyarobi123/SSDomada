-- CreateEnum
CREATE TYPE "PortalSetupRequestStatus" AS ENUM ('PENDING', 'DONE', 'DISMISSED');

-- CreateTable
CREATE TABLE "portal_setup_requests" (
    "id" TEXT NOT NULL,
    "resellerId" TEXT NOT NULL,
    "status" "PortalSetupRequestStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "details" JSONB NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "portal_setup_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "portal_setup_requests_status_createdAt_idx" ON "portal_setup_requests"("status", "createdAt");

-- CreateIndex
CREATE INDEX "portal_setup_requests_resellerId_createdAt_idx" ON "portal_setup_requests"("resellerId", "createdAt");

-- AddForeignKey
ALTER TABLE "portal_setup_requests" ADD CONSTRAINT "portal_setup_requests_resellerId_fkey" FOREIGN KEY ("resellerId") REFERENCES "resellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
