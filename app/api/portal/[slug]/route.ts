import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/server/lib/prisma";
import { RadiusService } from "@/server/services/radius.service";
import { PaymentService } from "@/server/services/payment.service";

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
    // Required for Omada External Portal v2 callback:
    //   clientMac, apMac, ssidName, radioId, site, t, redirectUrl
    const clientMac = searchParams.get("clientMac") || searchParams.get("client_mac") || "";
    const apMac = searchParams.get("apMac") || searchParams.get("ap_mac") || "";
    const ssidName = searchParams.get("ssidName") || searchParams.get("ssid") || "";
    const radioIdRaw =
      searchParams.get("radioId") ?? searchParams.get("radio_id") ?? "";
    const radioId =
      radioIdRaw !== "" && Number.isFinite(Number(radioIdRaw)) ? Number(radioIdRaw) : null;
    const omadaSiteId = searchParams.get("site") || "";
    const omadaT = searchParams.get("t") || "";
    const nasId = searchParams.get("nasId") || searchParams.get("nas_id") || "";
    const redirectUrl =
      searchParams.get("redirectUrl") ||
      searchParams.get("url") ||
      searchParams.get("redirect_url") ||
      "";
    const clientIpFromOmada = searchParams.get("clientIp") || searchParams.get("client_ip") || "";
    const clientIp =
      clientIpFromOmada ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "";

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
    let activeRadiusUser: { id: string; expiresAt: Date } | null = null;

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
        activeRadiusUser = { id: existing.id, expiresAt: existing.expiresAt };
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
      const normalisedMac = normalizeMac(clientMac);
      const normalisedApMac = apMac ? normalizeMac(apMac) : null;

      // Reuse pending sessions for the same MAC within the last 30 minutes so
      // refreshes / OS connectivity probes don't churn rows. Always refresh the
      // captured Omada parameters on each visit because they change per redirect
      // (timestamp, AP, radio).
      const existingSession = await prisma.portalSession.findFirst({
        where: {
          resellerId: reseller.id,
          clientMac: normalisedMac,
          status: { in: ["PENDING", "PAYING"] },
          createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) },
        },
        orderBy: { createdAt: "desc" },
      });

      const sessionData = {
        clientIp: clientIp || undefined,
        apMac: normalisedApMac || undefined,
        ssid: ssidName || undefined,
        ssidName: ssidName || undefined,
        radioId: radioId ?? undefined,
        omadaSiteId: omadaSiteId || undefined,
        omadaT: omadaT || undefined,
        nasId: nasId || undefined,
        redirectUrl: redirectUrl || undefined,
        ...(activeRadiusUser
          ? {
              status: "RADIUS_AUTHORIZED",
              radiusUserId: activeRadiusUser.id,
              expiresAt: activeRadiusUser.expiresAt,
            }
          : {}),
      } satisfies Record<string, unknown>;

      if (existingSession) {
        portalSession = await prisma.portalSession.update({
          where: { id: existingSession.id },
          data: sessionData,
        });
      } else {
        portalSession = await prisma.portalSession.create({
          data: {
            resellerId: reseller.id,
            clientMac: normalisedMac,
            ...sessionData,
          },
        });
      }

      if (activeRadiusUser && portalSession) {
        try {
          const activated = await PaymentService.retryPortalActivation(portalSession.id, reseller.id);
          if (activated) {
            portalSession = activated;
            isAuthorized = activated.status === "AUTHORIZED";
            remainingSeconds =
              isAuthorized && activated.expiresAt
                ? Math.max(0, Math.floor((activated.expiresAt.getTime() - Date.now()) / 1000))
                : 0;
          }
        } catch (activationErr) {
          console.warn("[Portal GET] active paid client Omada activation failed:", activationErr);
          isAuthorized = false;
          remainingSeconds = 0;
        }
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
