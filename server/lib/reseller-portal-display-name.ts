import { prisma } from "@/server/lib/prisma";

/** Display name pushed to Omada for the external portal (plan + company when subscribed). */
export async function getResellerOmadaPortalName(resellerId: string, companyName: string): Promise<string> {
  const sub = await prisma.resellerPlanSubscription.findUnique({
    where: { resellerId },
    include: { plan: { select: { name: true } } },
  });
  const planName = sub?.plan?.name?.trim();
  return planName ? `${planName} · ${companyName}` : `${companyName} Portal`;
}
