import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { RadiusService } from "@/server/services/radius.service";

interface RouteParams {
  params: Promise<{ slug: string }>;
}

/**
 * GET /api/portal/[slug]
 *
 * Public Captive Portal entry point.
 * Called when a client connects to WiFi and gets redirected by Omada.
 *
 * Omada sends query params:
 *   ?clientMac=AA-BB-CC-DD-EE-FF&apMac=...&ssid=...&nasId=...&url=...
 *
 * This endpoint:
 *   1. Identifies the reseller by brandSlug
 *   2. Creates a PortalSession
 *   3. Checks if client already has active RADIUS credentials
 *   4. Returns portal config (branding, packages) for the frontend to render
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { slug } = await params;

  try {
    const { searchParams } = new URL(req.url);
    const clientMac = searchParams.get("clientMac") || searchParams.get("client_mac") || "";
    const apMac = searchParams.get("apMac") || searchParams.get("ap_mac") || "";
    const ssid = searchParams.get("ssid") || "";
    const nasId = searchParams.get("nasId") || searchParams.get("nas_id") || "";
    const redirectUrl = searchParams.get("url") || searchParams.get("redirect_url") || "";
    const clientIp = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "";

    // 1. Find reseller by brandSlug
    const reseller = await prisma.reseller.findUnique({
      where: { brandSlug: slug },
      select: {
        id: true,
        companyName: true,
        brandSlug: true,
        logo: true,
        isActive: true,
      },
    });

    if (!reseller) {
      return NextResponse.json({ error: "Portal not found" }, { status: 404 });
    }

    if (!reseller.isActive) {
      return NextResponse.json({ error: "This portal is currently unavailable" }, { status: 503 });
    }

    // 2. Check if client already has active RADIUS access
    let isAuthorized = false;
    let remainingSeconds = 0;

    if (clientMac) {
      const existing = await prisma.radiusUser.findFirst({
        where: {
          resellerId: reseller.id,
          macAddress: normalizeMac(clientMac),
          isActive: true,
          expiresAt: { gt: new Date() },
        },
        orderBy: { expiresAt: "desc" },
      });

      if (existing) {
        isAuthorized = true;
        remainingSeconds = Math.floor((existing.expiresAt.getTime() - Date.now()) / 1000);
      }
    }

    // 3. Get captive portal branding config
    const portalConfig = await prisma.captivePortalConfig.findUnique({
      where: { resellerId: reseller.id },
    });

    // 4. Get available packages
    const packages = await prisma.package.findMany({
      where: { resellerId: reseller.id, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { price: "asc" }],
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        currency: true,
        duration: true,
        durationMinutes: true,
        dataLimitMb: true,
        speedLimitDown: true,
        speedLimitUp: true,
        maxDevices: true,
        isFeatured: true,
      },
    });

    // 5. Create or update portal session
    let portalSession = null;
    if (clientMac) {
      // Check for existing pending session
      const existingSession = await prisma.portalSession.findFirst({
        where: {
          resellerId: reseller.id,
          clientMac: normalizeMac(clientMac),
          status: { in: ["PENDING", "PAYING"] },
          createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) }, // last 30 min
        },
      });

      if (existingSession) {
        portalSession = existingSession;
      } else {
        portalSession = await prisma.portalSession.create({
          data: {
            resellerId: reseller.id,
            clientMac: normalizeMac(clientMac),
            clientIp,
            apMac,
            ssid,
            nasId,
            redirectUrl,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        portal: {
          companyName: portalConfig?.companyName || reseller.companyName,
          logo: portalConfig?.logo || reseller.logo,
          bgImage: portalConfig?.bgImage,
          bgColor: portalConfig?.bgColor,
          primaryColor: portalConfig?.primaryColor,
          accentColor: portalConfig?.accentColor,
          welcomeText: portalConfig?.welcomeText,
          termsUrl: portalConfig?.termsUrl,
          termsText: portalConfig?.termsText,
          template: portalConfig?.template || "default",
          showLogo: portalConfig?.showLogo ?? true,
          showSocial: portalConfig?.showSocial ?? false,
          socialLinks: portalConfig?.socialLinks,
          customCss: portalConfig?.customCss,
          customHtml: portalConfig?.customHtml,
        },
        packages,
        session: portalSession ? {
          id: portalSession.id,
          clientMac: portalSession.clientMac,
          status: portalSession.status,
        } : null,
        client: {
          mac: clientMac,
          isAuthorized,
          remainingSeconds: isAuthorized ? remainingSeconds : 0,
        },
      },
    });
  } catch (error) {
    console.error("[Portal GET] Error:", error);
    return NextResponse.json({ error: "Failed to load portal" }, { status: 500 });
  }
}

function normalizeMac(mac: string): string {
  return mac
    .replace(/[^a-fA-F0-9]/g, "")
    .match(/.{1,2}/g)
    ?.join("-")
    .toUpperCase() || mac.toUpperCase();
}
