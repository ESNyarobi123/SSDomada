import { NextRequest } from "next/server";
import { verifyReseller, apiSuccess, apiError, logResellerAction, getClientIp } from "@/server/middleware/reseller-auth";
import { RadiusService } from "@/server/services/radius.service";
import { paginationSchema } from "@/lib/validations/reseller";
import { ensureActiveResellerPlan, ensureCapacity } from "@/server/middleware/paywall";

/**
 * GET /api/v1/reseller/radius
 * List active RADIUS users (authorized WiFi clients), online sessions, accounting data.
 * ?view=active|online|accounting&username=xxx
 */
export async function GET(req: NextRequest) {
  const ctx = await verifyReseller(req);
  if (ctx instanceof Response) return ctx;

  try {
    const { searchParams } = new URL(req.url);
    const view = searchParams.get("view") || "active";
    const username = searchParams.get("username") || undefined;

    // Active RADIUS users (authorized clients)
    if (view === "active") {
      const { page, limit } = paginationSchema.parse({
        page: searchParams.get("page"),
        limit: searchParams.get("limit"),
      });
      const result = await RadiusService.getActiveUsers(ctx.resellerId, { page, limit });
      return apiSuccess(result.users, { page: result.page, limit: result.limit, total: result.total });
    }

    // Currently online sessions (from radacct)
    if (view === "online") {
      const sessions = await RadiusService.getOnlineSessions(ctx.resellerId);
      return apiSuccess({ sessions, count: sessions.length });
    }

    // Accounting data for a specific user
    if (view === "accounting" && username) {
      const accounting = await RadiusService.getAccountingForUser(username);
      return apiSuccess(accounting);
    }

    return apiError("Invalid view. Use: active, online, accounting", 400);
  } catch (error) {
    console.error("[Reseller RADIUS GET] Error:", error);
    return apiError("Failed to fetch RADIUS data", 500);
  }
}

/**
 * POST /api/v1/reseller/radius
 * Manually create RADIUS access or revoke access.
 * Actions: "grant" | "revoke" | "expire-stale"
 */
export async function POST(req: NextRequest) {
  const ctx = await verifyReseller(req);
  if (ctx instanceof Response) return ctx;

  try {
    const body = await req.json();
    const { action } = body;

    // === GRANT MANUAL ACCESS ===
    if (action === "grant") {
      const planGate = await ensureActiveResellerPlan(ctx.resellerId);
      if (planGate) return planGate;
      const capGate = await ensureCapacity(ctx.resellerId, "activeClients");
      if (capGate) return capGate;

      const { clientMac, sessionTimeoutMinutes, expiresInMinutes, bandwidthUpKbps, bandwidthDownKbps, maxSessions } = body;

      if (!clientMac) return apiError("clientMac is required", 400);

      const sessionTimeoutSeconds = (sessionTimeoutMinutes || 60) * 60;
      const expiresAt = new Date(Date.now() + (expiresInMinutes || 60) * 60 * 1000);

      const radiusUser = await RadiusService.createAccess({
        resellerId: ctx.resellerId,
        clientMac,
        authMethod: "MAC",
        sessionTimeoutSeconds,
        expiresAt,
        bandwidthUpBps: bandwidthUpKbps ? bandwidthUpKbps * 1000 : undefined,
        bandwidthDownBps: bandwidthDownKbps ? bandwidthDownKbps * 1000 : undefined,
        maxSessions: maxSessions || 1,
      });

      await logResellerAction(ctx.userId, "radius.access_granted", "RadiusUser", radiusUser.id, {
        clientMac,
        expiresAt: expiresAt.toISOString(),
      }, getClientIp(req));

      return apiSuccess({
        radiusUser,
        message: `WiFi access granted to ${clientMac}. Expires: ${expiresAt.toISOString()}`,
      });
    }

    // === REVOKE ACCESS ===
    if (action === "revoke") {
      const { clientMac, username } = body;

      if (username) {
        await RadiusService.revokeAccess(username);
        await logResellerAction(ctx.userId, "radius.access_revoked", "RadiusUser", undefined, { username }, getClientIp(req));
        return apiSuccess({ message: `Access revoked for ${username}` });
      }

      if (clientMac) {
        const count = await RadiusService.revokeByMac(ctx.resellerId, clientMac);
        await logResellerAction(ctx.userId, "radius.access_revoked", "RadiusUser", undefined, { clientMac, count }, getClientIp(req));
        return apiSuccess({ message: `${count} credential(s) revoked for MAC ${clientMac}` });
      }

      return apiError("clientMac or username is required", 400);
    }

    // === EXPIRE STALE ===
    if (action === "expire-stale") {
      const result = await RadiusService.expireStaleCredentials();
      await logResellerAction(ctx.userId, "radius.stale_expired", undefined, undefined, result, getClientIp(req));
      return apiSuccess(result);
    }

    return apiError("Invalid action. Use: grant, revoke, expire-stale", 400);
  } catch (error) {
    console.error("[Reseller RADIUS POST] Error:", error);
    return apiError("Failed to perform RADIUS action", 500);
  }
}
