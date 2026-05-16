import { prisma } from "@/server/lib/prisma";
import { OmadaService } from "@/server/services/omada.service";
import crypto from "crypto";

type RadiusUserForEnforcement = {
  id: string;
  resellerId: string;
  subscriptionId: string | null;
  username: string;
  macAddress: string | null;
  dataLimitBytes: bigint | null;
};

type AccessLimitReason = "expired" | "data_limit";

type OmadaKickTarget = {
  omadaSiteId: string;
  clientMac: string;
  portalSession: { apMac: string; ssidName: string; radioId: number } | null;
};

const DEFAULT_UNBLOCK_DELAY_MS = 5 * 60 * 1000;

function parseUnblockDelayMs(raw: string | undefined): number {
  if (!raw) return DEFAULT_UNBLOCK_DELAY_MS;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 1000) return DEFAULT_UNBLOCK_DELAY_MS;
  return Math.min(parsed, 60 * 60 * 1000);
}

const radiusUserEnforcementSelect = {
  id: true,
  resellerId: true,
  subscriptionId: true,
  username: true,
  macAddress: true,
  dataLimitBytes: true,
} as const;

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

      const radiusUser = await tx.radiusUser.upsert({
        where: { username },
        create: {
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
        update: {
          resellerId,
          userId,
          subscriptionId,
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
   * Expire all RADIUS credentials that have passed their expiresAt, enforce
   * data quotas, and actively ask Omada to remove clients from its authorised
   * state. Should be called by a cron job every minute.
   */
  static async expireStaleCredentials() {
    const now = new Date();

    const activeExpired = await prisma.radiusUser.findMany({
      where: { isActive: true, expiresAt: { lte: now } },
      select: radiusUserEnforcementSelect,
    });

    // Older sync code only set RadiusUser.isActive=false and could leave
    // radcheck/radreply rows behind. Include any expired RadiusUser that still
    // has RADIUS rows so the cleanup is self-healing after deploy.
    const radiusRowUsers = await prisma.radcheck.findMany({
      distinct: ["username"],
      select: { username: true },
      take: 5000,
    });
    const rowBackedUsernames = radiusRowUsers.map((r) => r.username);
    const inactiveExpiredWithRows = rowBackedUsernames.length
      ? await prisma.radiusUser.findMany({
          where: {
            isActive: false,
            expiresAt: { lte: now },
            username: { in: rowBackedUsernames },
          },
          select: radiusUserEnforcementSelect,
        })
      : [];

    const quotaExceeded = await this.findDataLimitExceededUsers(now);

    const usersToRevoke = new Map<
      string,
      RadiusUserForEnforcement & { reason: AccessLimitReason }
    >();
    for (const user of [...activeExpired, ...inactiveExpiredWithRows]) {
      usersToRevoke.set(user.id, { ...user, reason: "expired" });
    }
    for (const user of quotaExceeded) {
      if (!usersToRevoke.has(user.id)) {
        usersToRevoke.set(user.id, { ...user, reason: "data_limit" });
      }
    }

    let expired = 0;
    let dataLimited = 0;
    let omadaDeauthorized = 0;
    const errors: string[] = [];

    for (const user of usersToRevoke.values()) {
      const result = await this.revokeRadiusUserAndDisconnect(user, now);
      if (!result.revoked) continue;
      omadaDeauthorized += result.omadaDeauthorized;
      errors.push(...result.errors);
      if (user.reason === "data_limit") dataLimited++;
      else expired++;
    }

    const expiredSubscriptions = await prisma.subscription.updateMany({
      where: { status: "ACTIVE", expiresAt: { lte: now } },
      data: { status: "EXPIRED" },
    });

    // Sweep portal sessions whose time has passed but we never disconnected
    // them on Omada (e.g. left over from earlier deploys with a broken
    // disconnect path). Kick each before marking EXPIRED.
    const stalePortalSessions = await prisma.portalSession.findMany({
      where: {
        status: { in: ["AUTHORIZED", "RADIUS_AUTHORIZED", "OMADA_AUTH_FAILED"] },
        expiresAt: { lte: now },
        omadaSiteId: { not: null },
      },
      select: {
        id: true,
        omadaSiteId: true,
        clientMac: true,
        resellerId: true,
        apMac: true,
        ssidName: true,
        radioId: true,
      },
      take: 500,
    });

    let staleKicked = 0;
    const alreadyKickedMacs = new Set(
      Array.from(usersToRevoke.values())
        .map((u) => u.macAddress?.toUpperCase())
        .filter(Boolean) as string[],
    );
    for (const session of stalePortalSessions) {
      if (!session.omadaSiteId) continue;
      if (alreadyKickedMacs.has(session.clientMac.toUpperCase())) continue;

      const result = await this.forceKickFromOmada({
        omadaSiteId: session.omadaSiteId,
        clientMac: session.clientMac,
        portalSession:
          session.apMac && session.ssidName && session.radioId !== null
            ? { apMac: session.apMac, ssidName: session.ssidName, radioId: session.radioId }
            : null,
        label: `stale-session=${session.id}`,
      });
      if (result.kicked) {
        staleKicked++;
        omadaDeauthorized++;
      }
      errors.push(...result.errors);
    }

    const expiredPortalSessions = await prisma.portalSession.updateMany({
      where: {
        status: { in: ["AUTHORIZED", "RADIUS_AUTHORIZED", "OMADA_AUTH_FAILED"] },
        expiresAt: { lte: now },
      },
      data: { status: "EXPIRED" },
    });

    return {
      expired,
      dataLimited,
      omadaDeauthorized,
      staleKicked,
      expiredSubscriptions: expiredSubscriptions.count,
      expiredPortalSessions: expiredPortalSessions.count,
      errors: errors.slice(0, 20),
    };
  }

  private static async findDataLimitExceededUsers(now: Date): Promise<RadiusUserForEnforcement[]> {
    const users = await prisma.radiusUser.findMany({
      where: {
        isActive: true,
        expiresAt: { gt: now },
        dataLimitBytes: { not: null },
      },
      select: radiusUserEnforcementSelect,
      take: 1000,
    });

    const exceeded: RadiusUserForEnforcement[] = [];

    for (const user of users) {
      if (!user.dataLimitBytes) continue;

      const usage = await this.getTotalUsageBytes(user.username);
      if (user.subscriptionId) {
        await prisma.subscription.update({
          where: { id: user.subscriptionId },
          data: { dataUsedMb: bytesToMegabytes(usage) },
        }).catch((err) => {
          console.warn(`[RADIUS] Failed to update data usage for subscription ${user.subscriptionId}:`, err);
        });
      }

      if (usage >= user.dataLimitBytes) {
        exceeded.push(user);
      }
    }

    return exceeded;
  }

  private static async revokeRadiusUserAndDisconnect(
    user: RadiusUserForEnforcement & { reason: AccessLimitReason },
    now: Date,
  ) {
    const errors: string[] = [];
    let omadaDeauthorized = 0;

    const freshUser = await prisma.radiusUser.findUnique({
      where: { id: user.id },
      select: {
        username: true,
        isActive: true,
        expiresAt: true,
        dataLimitBytes: true,
      },
    });
    if (!freshUser || freshUser.username !== user.username) {
      return { revoked: false, omadaDeauthorized, errors };
    }

    if (user.reason === "expired" && freshUser.expiresAt > now) {
      return { revoked: false, omadaDeauthorized, errors };
    }

    if (user.reason === "data_limit") {
      if (!freshUser.isActive || !freshUser.dataLimitBytes) {
        return { revoked: false, omadaDeauthorized, errors };
      }
      const usage = await this.getTotalUsageBytes(user.username);
      if (usage < freshUser.dataLimitBytes) {
        return { revoked: false, omadaDeauthorized, errors };
      }
    }

    const targets = await this.findOmadaDeauthTargets(user);
    if (targets.length === 0) {
      errors.push(
        `Omada disconnect skipped user=${user.username}: no portal session or linked Omada site found for MAC=${user.macAddress ?? "?"}`,
      );
      console.warn(
        `[RADIUS] No Omada disconnect target for user=${user.username} mac=${user.macAddress ?? "?"} — client will keep WiFi until they roam/reauth.`,
      );
    }
    for (const target of targets) {
      const result = await this.forceKickFromOmada({
        omadaSiteId: target.omadaSiteId,
        clientMac: target.clientMac,
        portalSession: target.portalSession,
        label: `user=${user.username}`,
      });
      if (result.kicked) omadaDeauthorized++;
      errors.push(...result.errors);
    }

    await this.revokeAccess(user.username);

    if (user.subscriptionId) {
      await prisma.subscription.updateMany({
        where: { id: user.subscriptionId },
        data: { status: "EXPIRED" },
      });
    }

    const portalWhere: any = {
      resellerId: user.resellerId,
      status: { in: ["AUTHORIZED", "RADIUS_AUTHORIZED", "OMADA_AUTH_FAILED", "PAYING"] },
      OR: [{ radiusUserId: user.id }],
    };
    if (user.macAddress) {
      portalWhere.OR.push({ clientMac: user.macAddress });
    }
    if (user.reason === "expired") {
      portalWhere.expiresAt = { lte: now };
    }

    await prisma.portalSession.updateMany({
      where: portalWhere,
      data: { status: "EXPIRED" },
    });

    console.log(
      `[RADIUS] Revoked ${user.username} reason=${user.reason} omadaDeauthorized=${omadaDeauthorized}`,
    );

    return { revoked: true, omadaDeauthorized, errors };
  }

  private static async findOmadaDeauthTargets(user: RadiusUserForEnforcement) {
    if (!user.macAddress) return [];

    const sessions = await prisma.portalSession.findMany({
      where: {
        resellerId: user.resellerId,
        omadaSiteId: { not: null },
        OR: [{ radiusUserId: user.id }, { clientMac: user.macAddress }],
      },
      orderBy: { updatedAt: "desc" },
      select: {
        omadaSiteId: true,
        clientMac: true,
        apMac: true,
        ssidName: true,
        radioId: true,
      },
      take: 5,
    });

    const targets = new Map<
      string,
      OmadaKickTarget
    >();
    for (const session of sessions) {
      if (!session.omadaSiteId) continue;
      targets.set(`${session.omadaSiteId}:${session.clientMac}`, {
        omadaSiteId: session.omadaSiteId,
        clientMac: session.clientMac,
        portalSession:
          session.apMac && session.ssidName && session.radioId !== null
            ? {
                apMac: session.apMac,
                ssidName: session.ssidName,
                radioId: session.radioId,
              }
            : null,
      });
    }

    if (targets.size === 0) {
      const site = await prisma.site.findFirst({
        where: { resellerId: user.resellerId, omadaSiteId: { not: null }, isActive: true },
        orderBy: { createdAt: "asc" },
        select: { omadaSiteId: true },
      });
      if (site?.omadaSiteId) {
        targets.set(`${site.omadaSiteId}:${user.macAddress}`, {
          omadaSiteId: site.omadaSiteId,
          clientMac: user.macAddress,
          portalSession: null,
        });
      }
    }

    return Array.from(targets.values());
  }

  /**
   * Aggressively force a client off Omada — used both by the cron job and
   * the stale-session sweep.
   *
   * IMPORTANT: Omada's External Portal v2 API has NO real deauthorisation
   * endpoint. Re-calling `extPortal/auth` with `time=1` does NOT invalidate
   * the existing session — Omada keeps the original auth state and the
   * client can keep using WiFi after we kick them. Reconnect is also
   * unreliable (returns errorCode=0 but doesn't always actually drop the
   * association).
   *
   * The ONLY way to guarantee the client is kicked is to BLOCK them at the
   * AP level. Block puts them on the AP blocklist so they cannot associate
   * at all. We then UNBLOCK after a longer delay (default 5 min) so they
   * can come back and pay again. If they pay BEFORE the unblock fires, the
   * payment webhook unblocks immediately and re-authorises.
   *
   * The unblock delay is configurable via env `OMADA_UNBLOCK_DELAY_MS`
   * (default 300_000 = 5 min). Increase if your Omada controller takes
   * longer to clear stale captive-portal auth state.
   *
   * Order of operations:
   *   1. OpenAPI `unauthorize`   (clears any OpenAPI auth state)
   *   2. External Portal deauth  (best-effort, may be a no-op)
   *   3. BLOCK                   (primary kick — drops connection + prevents reassoc)
   *   4. Reconnect               (best-effort secondary kick)
   *   5. Schedule UNBLOCK after `OMADA_UNBLOCK_DELAY_MS` so the next
   *      payment can authorise. Payment webhook can unblock earlier.
   */
  static async forceKickFromOmada(args: {
    omadaSiteId: string;
    clientMac: string;
    portalSession?: { apMac: string; ssidName: string; radioId: number } | null;
    label: string;
  }): Promise<{ kicked: boolean; errors: string[] }> {
    const { omadaSiteId, clientMac, portalSession, label } = args;
    const errors: string[] = [];

    // 1. Clear OpenAPI auth state (cheap, doesn't hurt if not used).
    try {
      await OmadaService.deauthorizeClient(omadaSiteId, clientMac);
    } catch (err: any) {
      const message = err?.message || String(err);
      errors.push(`Omada unauthorize failed ${label} site=${omadaSiteId}: ${message}`);
      console.warn(`[RADIUS] Omada unauthorize failed ${label}:`, err);
    }

    // 2. External Portal v2 deauth — only works if we have the original
    //    apMac / ssidName / radioId from PortalSession. Without these we
    //    can't construct a valid extPortal/auth call.
    if (portalSession) {
      try {
        const res = await OmadaService.deauthorizeExternalPortalClient({
          clientMac,
          apMac: portalSession.apMac,
          ssidName: portalSession.ssidName,
          radioId: portalSession.radioId,
          site: omadaSiteId,
        });
        if (res.ok) {
          console.log(`[RADIUS] extPortal/auth deauth ok ${label} mac=${clientMac}`);
        } else {
          console.warn(
            `[RADIUS] extPortal/auth deauth failed ${label} mac=${clientMac}: errorCode=${res.errorCode} msg=${res.message}`,
          );
        }
      } catch (err: any) {
        console.warn(`[RADIUS] extPortal/auth deauth threw ${label}:`, err?.message || err);
      }
    }

    // 3. BLOCK — primary force-kick. Adds client to AP blocklist which both
    //    drops the current association and prevents immediate re-association.
    const block = await OmadaService.blockClient(omadaSiteId, clientMac).catch((err: any) => ({
      ok: false as const,
      path: "(threw)" as const,
      errorCode: undefined,
      msg: err?.message || String(err),
    }));

    // 4. Reconnect (cheap secondary). Some controller builds drop the
    //    association on reconnect even when block is rejected.
    const reconnect = await OmadaService.disconnectClient(omadaSiteId, clientMac).catch(
      (err: any) => ({
        ok: false as const,
        path: "(threw)" as const,
        errorCode: undefined,
        msg: err?.message || String(err),
      }),
    );

    if (block.ok) {
      // 5. Schedule UNBLOCK after configured delay so the client can re-pay
      //    and reconnect. The payment webhook will also call unblock as
      //    soon as a fresh payment comes in (whichever happens first wins).
      const unblockDelayMs = parseUnblockDelayMs(process.env.OMADA_UNBLOCK_DELAY_MS);
      console.log(
        `[RADIUS] BLOCKED ${label} mac=${clientMac} site=${omadaSiteId} via ${block.path} (reconnect=${reconnect.ok ? "ok" : `fail:${reconnect.msg ?? reconnect.errorCode}`}, unblockInMs=${unblockDelayMs})`,
      );
      setTimeout(() => {
        OmadaService.unblockClient(omadaSiteId, clientMac)
          .then(() => {
            console.log(
              `[RADIUS] Auto-unblocked ${label} mac=${clientMac} after ${unblockDelayMs}ms`,
            );
          })
          .catch((err) => {
            console.warn(
              `[RADIUS] Delayed unblock failed ${label} mac=${clientMac}: ${err?.message || err}`,
            );
          });
      }, unblockDelayMs);
      return { kicked: true, errors };
    }

    if (reconnect.ok) {
      // Block failed but reconnect succeeded — still considered kicked (best effort).
      console.log(
        `[RADIUS] reconnect-only kick ${label} mac=${clientMac} site=${omadaSiteId} via ${reconnect.path} (block=${block.msg ?? block.errorCode})`,
      );
      return { kicked: true, errors };
    }

    const detail = `block=${block.msg ?? `errorCode=${block.errorCode}`} reconnect=${reconnect.msg ?? `errorCode=${reconnect.errorCode}`}`;
    errors.push(`Omada force-kick failed ${label} site=${omadaSiteId}: ${detail}`);
    console.warn(`[RADIUS] Omada force-kick failed ${label} mac=${clientMac}: ${detail}`);
    return { kicked: false, errors };
  }

  private static async getTotalUsageBytes(username: string): Promise<bigint> {
    const usage = await prisma.radacct.aggregate({
      where: { username },
      _sum: {
        acctinputoctets: true,
        acctoutputoctets: true,
      },
    });

    return (usage._sum.acctinputoctets || BigInt(0)) + (usage._sum.acctoutputoctets || BigInt(0));
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

function bytesToMegabytes(bytes: bigint): number {
  return Number(bytes / BigInt(1024)) / 1024;
}
