import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/server/lib/prisma";
import { OmadaService } from "@/server/services/omada.service";
import { ResellerPlanService } from "@/server/services/reseller-plan.service";
import type { UserRole } from "@prisma/client";

const SESSION_DAYS = 30;

function slugify(input: string): string {
  const s = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return s || "wifi-brand";
}

async function uniqueBrandSlug(base: string): Promise<string> {
  let slug = slugify(base);
  let n = 0;
  while (await prisma.reseller.findUnique({ where: { brandSlug: slug } })) {
    n += 1;
    slug = `${slugify(base)}-${n}`;
  }
  return slug;
}

export class AuthService {
  static async hashPassword(plain: string): Promise<string> {
    return bcrypt.hash(plain, 12);
  }

  static async verifyPassword(plain: string, hashed: string | null): Promise<boolean> {
    if (!hashed) return false;
    return bcrypt.compare(plain, hashed);
  }

  static async createSession(userId: string): Promise<string> {
    const sessionToken = randomBytes(32).toString("hex");
    const expires = new Date();
    expires.setDate(expires.getDate() + SESSION_DAYS);
    await prisma.session.create({
      data: { sessionToken, userId, expires },
    });
    return sessionToken;
  }

  static async deleteSession(token: string): Promise<void> {
    await prisma.session.deleteMany({ where: { sessionToken: token } });
  }

  static async login(email: string, password: string) {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: { reseller: { select: { id: true, companyName: true, brandSlug: true, isActive: true } } },
    });
    if (!user || !user.password) return { ok: false as const, code: "INVALID_CREDENTIALS" };
    const ok = await this.verifyPassword(password, user.password);
    if (!ok) return { ok: false as const, code: "INVALID_CREDENTIALS" };
    if (!user.isActive) return { ok: false as const, code: "ACCOUNT_INACTIVE" };
    const token = await this.createSession(user.id);
    return { ok: true as const, user, token };
  }

  static async register(data: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    role: UserRole;
    companyName?: string;
    brandSlug?: string;
    planSlug?: string;
  }) {
    const email = data.email.toLowerCase().trim();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return { error: "EMAIL_TAKEN" as const };

    const hashed = await this.hashPassword(data.password);

    if (data.role === "RESELLER") {
      const company = data.companyName?.trim() || `${data.name}'s WiFi`;
      const brandSlug = data.brandSlug?.trim()
        ? await uniqueBrandSlug(data.brandSlug.trim())
        : await uniqueBrandSlug(company);

      const user = await prisma.user.create({
        data: {
          name: data.name.trim(),
          email,
          phone: data.phone?.trim(),
          password: hashed,
          role: "RESELLER",
          emailVerified: null,
        },
      });
      const reseller = await prisma.reseller.create({
        data: {
          userId: user.id,
          companyName: company,
          brandSlug,
          phone: data.phone?.trim(),
          currency: "TZS",
        },
      });

      // Bootstrap reseller resources (captive portal config + default Omada site).
      // Best-effort: failures should not block registration.
      try {
        await prisma.captivePortalConfig.create({
          data: { resellerId: reseller.id, companyName: company },
        });
      } catch (err) {
        console.error("[AuthService] captive portal config create failed:", err);
      }

      // Fire-and-forget Omada site creation. We don't await this in a blocking way
      // because Omada call can be slow / unreachable.
      void OmadaService.ensureResellerSite(reseller.id, company).catch((err) => {
        console.error("[AuthService] ensureResellerSite failed:", err);
      });

      await ResellerPlanService.assignInitialPlan(reseller.id, data.planSlug).catch((err) => {
        console.error("[AuthService] assignInitialPlan failed:", err);
      });

      const full = await prisma.user.findUnique({
        where: { id: user.id },
        include: { reseller: { select: { id: true, companyName: true, brandSlug: true, isActive: true } } },
      });
      const token = await this.createSession(user.id);
      return { user: full!, token };
    }

    const user = await prisma.user.create({
      data: {
        name: data.name.trim(),
        email,
        phone: data.phone?.trim(),
        password: hashed,
        role: "END_USER",
        emailVerified: null,
      },
    });
    const full = await prisma.user.findUnique({
      where: { id: user.id },
      include: { reseller: { select: { id: true, companyName: true, brandSlug: true, isActive: true } } },
    });
    const token = await this.createSession(user.id);
    return { user: full!, token };
  }

  static async getSessionUser(token: string) {
    const session = await prisma.session.findUnique({
      where: { sessionToken: token },
      include: {
        user: {
          include: {
            reseller: { select: { id: true, companyName: true, brandSlug: true, isActive: true } },
          },
        },
      },
    });
    if (!session || session.expires < new Date()) return null;
    return session.user;
  }
}
