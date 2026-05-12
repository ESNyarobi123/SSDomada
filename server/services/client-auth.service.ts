import { prisma } from "@/server/lib/prisma";
import { OmadaService } from "./omada.service";

/**
 * Handles WiFi client authorization via Captive Portal
 * Flow: Client connects → sees portal → pays → gets authorized on Omada
 */
export class ClientAuthService {
  /**
   * Authorize a WiFi client after successful payment
   */
  static async authorizeClient(data: {
    userId: string;
    siteId: string;
    clientMac: string;
    clientIp?: string;
    subscriptionId: string;
  }) {
    // 1. Verify subscription is active
    const subscription = await prisma.subscription.findUnique({
      where: { id: data.subscriptionId },
      include: { package: true },
    });

    if (!subscription || subscription.status !== "ACTIVE") {
      throw new Error("No active subscription found");
    }

    // 2. Authorize client on Omada Controller
    // TODO: Call OmadaService.authorizeClient()

    // 3. Create WiFi session record
    const session = await prisma.wifiSession.create({
      data: {
        userId: data.userId,
        siteId: data.siteId,
        subscriptionId: data.subscriptionId,
        clientMac: data.clientMac,
        clientIp: data.clientIp,
      },
    });

    return session;
  }

  /**
   * Deauthorize a WiFi client (when subscription expires)
   */
  static async deauthorizeClient(data: {
    sessionId: string;
    clientMac: string;
    siteId: string;
  }) {
    // 1. Deauthorize on Omada Controller
    // TODO: Call OmadaService.deauthorizeClient()

    // 2. End WiFi session
    const session = await prisma.wifiSession.update({
      where: { id: data.sessionId },
      data: { endedAt: new Date() },
    });

    return session;
  }

  /**
   * Check if a client MAC is currently authorized
   */
  static async isClientAuthorized(clientMac: string, siteId: string): Promise<boolean> {
    const activeSession = await prisma.wifiSession.findFirst({
      where: {
        clientMac,
        siteId,
        endedAt: null,
        subscription: { status: "ACTIVE" },
      },
    });

    return !!activeSession;
  }

  /**
   * Get portal config and packages for a brand
   */
  static async getPortalData(brandSlug: string) {
    const reseller = await prisma.reseller.findUnique({
      where: { brandSlug },
      include: {
        captivePortalConfig: true,
        packages: {
          where: { isActive: true },
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    if (!reseller || !reseller.isActive) {
      return null;
    }

    return {
      reseller: {
        id: reseller.id,
        companyName: reseller.companyName,
        brandSlug: reseller.brandSlug,
      },
      portalConfig: reseller.captivePortalConfig,
      packages: reseller.packages,
    };
  }
}
