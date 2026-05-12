import { prisma } from "@/server/lib/prisma";
import crypto from "crypto";

/**
 * RADIUS Service — Manages FreeRADIUS SQL records.
 *
 * Flow:
 *   1. Customer pays → payment.completed webhook fires
 *   2. RadiusService.createAccess() writes radcheck + radreply + RadiusUser
 *   3. Customer reconnects → FreeRADIUS queries radcheck → Access-Accept
 *   4. Omada grants WiFi access with Session-Timeout from radreply
 *   5. FreeRADIUS writes radacct records for accounting
 *   6. Cron job or webhook expires stale credentials
 */
export class RadiusService {
  // ============================================================
  // CREATE RADIUS ACCESS — After successful payment
  // ============================================================

  /**
   * Grant WiFi access for a client after successful payment.
   * Creates FreeRADIUS SQL records (radcheck + radreply) and our RadiusUser tracking record.
   *
   * @param input - Client info, package details, reseller context
   * @returns RadiusUser with generated credentials
   */
  static async createAccess(input: {
    resellerId: string;
    userId?: string;
    subscriptionId?: string;
    clientMac: string;
    authMethod?: "MAC" | "VOUCHER" | "USERNAME";
    voucherCode?: string;
    sessionTimeoutSeconds: number;
    expiresAt: Date;
    dataLimitBytes?: bigint;
    bandwidthUpBps?: number;
    bandwidthDownBps?: number;
    maxSessions?: number;
  }) {
    const {
      resellerId,
      userId,
      subscriptionId,
      clientMac,
      authMethod = "MAC",
      voucherCode,
      sessionTimeoutSeconds,
      expiresAt,
      dataLimitBytes,
      bandwidthUpBps,
      bandwidthDownBps,
      maxSessions = 1,
    } = input;

    // Normalize MAC: FreeRADIUS expects AA-BB-CC-DD-EE-FF (dashes, uppercase)
    const normalizedMac = normalizeMacForRadius(clientMac);

    // Username = MAC address for MAC auth, voucher code for voucher auth
    const username = authMethod === "VOUCHER" && voucherCode
      ? voucherCode
      : normalizedMac;

    // Generate a random password
    const password = generatePassword();

    // Use a transaction to keep radcheck + radreply + RadiusUser in sync
    return prisma.$transaction(async (tx) => {
      // 1. Remove any existing RADIUS records for this username (re-auth scenario)
      await tx.radcheck.deleteMany({ where: { username } });
      await tx.radreply.deleteMany({ where: { username } });
      await tx.radusergroup.deleteMany({ where: { username } });

      // 2. radcheck — authentication attributes
      await tx.radcheck.createMany({
        data: [
          // Password
          { username, attribute: "Cleartext-Password", op: ":=", value: password },
          // Expiration date
          { username, attribute: "Expiration", op: ":=", value: formatRadiusDate(expiresAt) },
        ],
      });

      // For MAC auth, also add MAC address check
      if (authMethod === "MAC") {
        await tx.radcheck.create({
          data: { username, attribute: "Calling-Station-Id", op: "==", value: normalizedMac },
        });
      }

      // 3. radreply — reply attributes (sent to NAS after auth)
      const replyAttrs: Array<{ username: string; attribute: string; op: string; value: string }> = [
        // Session timeout in seconds
        { username, attribute: "Session-Timeout", op: ":=", value: String(sessionTimeoutSeconds) },
        // Idle timeout (disconnect after 5 min idle)
        { username, attribute: "Idle-Timeout", op: ":=", value: "300" },
        // Acct-Interim-Interval (accounting updates every 60s)
        { username, attribute: "Acct-Interim-Interval", op: ":=", value: "60" },
      ];

      // Bandwidth limits (WISPr attributes — supported by Omada)
      if (bandwidthDownBps) {
        replyAttrs.push(
          { username, attribute: "WISPr-Bandwidth-Max-Down", op: ":=", value: String(bandwidthDownBps) }
        );
      }
      if (bandwidthUpBps) {
        replyAttrs.push(
          { username, attribute: "WISPr-Bandwidth-Max-Up", op: ":=", value: String(bandwidthUpBps) }
        );
      }

      // Simultaneous-Use (max concurrent sessions)
      if (maxSessions > 0) {
        replyAttrs.push(
          { username, attribute: "Simultaneous-Use", op: ":=", value: String(maxSessions) }
        );
      }

      await tx.radreply.createMany({ data: replyAttrs });

      // 4. User group mapping (package-based groups for shared policies)
      await tx.radusergroup.create({
        data: { username, groupname: `reseller-${resellerId}`, priority: 1 },
      });

      // 5. Application-level RadiusUser record
      // Deactivate any previous RadiusUser for same MAC + reseller
      await tx.radiusUser.updateMany({
        where: { resellerId, macAddress: normalizedMac, isActive: true },
        data: { isActive: false },
      });

      const radiusUser = await tx.radiusUser.create({
        data: {
          resellerId,
          userId,
          subscriptionId,
          username,
          password,
          macAddress: normalizedMac,
          isActive: true,
          expiresAt,
          sessionTimeout: sessionTimeoutSeconds,
          dataLimitBytes,
          bandwidthUp: bandwidthUpBps,
          bandwidthDown: bandwidthDownBps,
          maxSessions,
          authMethod,
        },
      });

      return radiusUser;
    });
  }

  // ============================================================
  // REVOKE ACCESS — Disconnect / block user
  // ============================================================

  /**
   * Revoke WiFi access for a specific username.
   * Removes RADIUS credentials so FreeRADIUS will reject future auth requests.
   */
  static async revokeAccess(username: string) {
    return prisma.$transaction(async (tx) => {
      await tx.radcheck.deleteMany({ where: { username } });
      await tx.radreply.deleteMany({ where: { username } });
      await tx.radusergroup.deleteMany({ where: { username } });
      await tx.radiusUser.updateMany({
        where: { username },
        data: { isActive: false },
      });
    });
  }

  /**
   * Revoke access by MAC address for a specific reseller.
   */
  static async revokeByMac(resellerId: string, clientMac: string) {
    const normalizedMac = normalizeMacForRadius(clientMac);
    const radiusUsers = await prisma.radiusUser.findMany({
      where: { resellerId, macAddress: normalizedMac, isActive: true },
    });

    for (const ru of radiusUsers) {
      await this.revokeAccess(ru.username);
    }

    return radiusUsers.length;
  }

  // ============================================================
  // EXPIRE STALE CREDENTIALS — Cron job target
  // ============================================================

  /**
   * Expire all RADIUS credentials that have passed their expiresAt.
   * Should be called by a cron job every minute.
   */
  static async expireStaleCredentials() {
    const now = new Date();

    const expired = await prisma.radiusUser.findMany({
      where: { isActive: true, expiresAt: { lte: now } },
      select: { id: true, username: true },
    });

    let count = 0;
    for (const ru of expired) {
      await this.revokeAccess(ru.username);
      count++;
    }

    return { expired: count };
  }

  // ============================================================
  // QUERY — Active sessions and accounting
  // ============================================================

  /**
   * Get active RADIUS users for a reseller.
   */
  static async getActiveUsers(resellerId: string, options?: { page?: number; limit?: number }) {
    const page = options?.page || 1;
    const limit = options?.limit || 50;

    const [users, total] = await Promise.all([
      prisma.radiusUser.findMany({
        where: { resellerId, isActive: true },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { name: true, phone: true, email: true } },
          subscription: { select: { package: { select: { name: true, duration: true } } } },
        },
      }),
      prisma.radiusUser.count({ where: { resellerId, isActive: true } }),
    ]);

    return { users, total, page, limit };
  }

  /**
   * Get RADIUS accounting data for a specific user (data usage, session time).
   */
  static async getAccountingForUser(username: string) {
    const records = await prisma.radacct.findMany({
      where: { username },
      orderBy: { acctstarttime: "desc" },
      take: 50,
    });

    // Aggregate totals
    let totalSessionTime = 0;
    let totalUploadBytes = BigInt(0);
    let totalDownloadBytes = BigInt(0);

    for (const r of records) {
      totalSessionTime += r.acctsessiontime || 0;
      totalUploadBytes += r.acctinputoctets;
      totalDownloadBytes += r.acctoutputoctets;
    }

    return {
      sessions: records,
      totals: {
        sessionTime: totalSessionTime,
        uploadBytes: totalUploadBytes.toString(),
        downloadBytes: totalDownloadBytes.toString(),
        totalBytes: (totalUploadBytes + totalDownloadBytes).toString(),
      },
    };
  }

  /**
   * Check if a MAC address has active RADIUS credentials for a reseller.
   */
  static async isAuthorized(resellerId: string, clientMac: string): Promise<boolean> {
    const normalizedMac = normalizeMacForRadius(clientMac);
    const count = await prisma.radiusUser.count({
      where: {
        resellerId,
        macAddress: normalizedMac,
        isActive: true,
        expiresAt: { gt: new Date() },
      },
    });
    return count > 0;
  }

  /**
   * Get all online sessions from radacct (no stop time = still connected).
   */
  static async getOnlineSessions(resellerId: string) {
    // Get all active usernames for this reseller
    const activeUsers = await prisma.radiusUser.findMany({
      where: { resellerId, isActive: true },
      select: { username: true, macAddress: true, expiresAt: true },
    });

    const usernames = activeUsers.map((u) => u.username);

    const sessions = await prisma.radacct.findMany({
      where: {
        username: { in: usernames },
        acctstoptime: null, // still connected
      },
      orderBy: { acctstarttime: "desc" },
    });

    return sessions.map((s) => {
      const ru = activeUsers.find((u) => u.username === s.username);
      return {
        ...s,
        acctinputoctets: s.acctinputoctets.toString(),
        acctoutputoctets: s.acctoutputoctets.toString(),
        expiresAt: ru?.expiresAt,
      };
    });
  }
}

// ============================================================
// HELPERS
// ============================================================

/**
 * Normalize MAC to RADIUS format: AA-BB-CC-DD-EE-FF (dashes, uppercase).
 * Omada sends Calling-Station-Id in this format.
 */
function normalizeMacForRadius(mac: string): string {
  return mac
    .replace(/[^a-fA-F0-9]/g, "")
    .match(/.{1,2}/g)
    ?.join("-")
    .toUpperCase() || mac.toUpperCase();
}

/**
 * Generate a random 12-character alphanumeric password.
 */
function generatePassword(): string {
  return crypto.randomBytes(8).toString("base64url").slice(0, 12);
}

/**
 * Format a Date to FreeRADIUS Expiration attribute format: "January 01 2025 00:00:00"
 */
function formatRadiusDate(date: Date): string {
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const m = months[date.getMonth()];
  const d = String(date.getDate()).padStart(2, "0");
  const y = date.getFullYear();
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  const s = String(date.getSeconds()).padStart(2, "0");
  return `${m} ${d} ${y} ${h}:${min}:${s}`;
}
