import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AuthService } from "@/server/services/auth.service";

export const dynamic = "force-dynamic";

const COOKIE = "ssdomada_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

function setAuthCookie(res: NextResponse, token: string) {
  res.cookies.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  });
}

function clearAuthCookie(res: NextResponse) {
  res.cookies.set(COOKIE, "", { path: "/", maxAge: 0, httpOnly: true, sameSite: "lax" });
}

function publicUser(u: {
  id: string;
  email: string;
  name: string | null;
  role: string;
  phone: string | null;
  reseller: { id: string; companyName: string; brandSlug: string } | null;
}) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    phone: u.phone,
    reseller: u.reseller,
  };
}

const loginSchema = z.object({
  action: z.literal("login"),
  email: z.string().email(),
  password: z.string().min(1),
});

const registerSchema = z.object({
  action: z.literal("register"),
  role: z.enum(["RESELLER", "END_USER"]),
  name: z.string().min(1).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  phone: z.string().max(30).optional(),
  companyName: z.string().min(1).max(200).optional(),
  brandSlug: z.string().max(60).optional(),
});

function getToken(req: NextRequest): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return req.cookies.get(COOKIE)?.value ?? null;
}

/** POST — login | register | logout */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const action = body?.action;

    if (action === "logout") {
      const token = getToken(req);
      if (token) await AuthService.deleteSession(token);
      const res = NextResponse.json({ success: true });
      clearAuthCookie(res);
      return res;
    }

    if (action === "login") {
      const parsed = loginSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json({ success: false, error: "Invalid request", code: "VALIDATION" }, { status: 400 });
      }
      const { email, password } = parsed.data;
      const result = await AuthService.login(email, password);
      if (!result.ok) {
        const status = result.code === "ACCOUNT_INACTIVE" ? 403 : 401;
        return NextResponse.json(
          {
            success: false,
            error: result.code === "ACCOUNT_INACTIVE" ? "Account deactivated" : "Invalid email or password",
            code: result.code,
          },
          { status }
        );
      }
      const res = NextResponse.json({
        success: true,
        data: { user: publicUser(result.user), token: result.token },
      });
      setAuthCookie(res, result.token);
      return res;
    }

    if (action === "register") {
      const parsed = registerSchema.safeParse(body);
      if (!parsed.success) {
        return NextResponse.json(
          { success: false, error: parsed.error.flatten().fieldErrors, code: "VALIDATION" },
          { status: 400 }
        );
      }
      const d = parsed.data;
      if (d.role === "RESELLER" && !d.companyName?.trim()) {
        return NextResponse.json(
          { success: false, error: "Company name is required for reseller signup", code: "VALIDATION" },
          { status: 400 }
        );
      }
      const reg = await AuthService.register({
        name: d.name,
        email: d.email,
        password: d.password,
        phone: d.phone,
        role: d.role,
        companyName: d.companyName,
        brandSlug: d.brandSlug,
      });
      if ("error" in reg) {
        return NextResponse.json({ success: false, error: "Email already registered", code: reg.error }, { status: 409 });
      }
      const res = NextResponse.json({
        success: true,
        data: { user: publicUser(reg.user), token: reg.token },
      });
      setAuthCookie(res, reg.token);
      return res;
    }

    return NextResponse.json({ success: false, error: "Unknown action", code: "BAD_REQUEST" }, { status: 400 });
  } catch (error) {
    console.error("[auth POST]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

/** GET — current session */
export async function GET(req: NextRequest) {
  try {
    const token = getToken(req);
    if (!token) {
      return NextResponse.json({ success: true, data: { user: null } });
    }
    const user = await AuthService.getSessionUser(token);
    if (!user) {
      const res = NextResponse.json({ success: true, data: { user: null } });
      clearAuthCookie(res);
      return res;
    }
    return NextResponse.json({
      success: true,
      data: { user: publicUser(user) },
    });
  } catch (error) {
    console.error("[auth GET]", error);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}

/** DELETE — logout */
export async function DELETE(req: NextRequest) {
  const token = getToken(req);
  if (token) await AuthService.deleteSession(token);
  const res = NextResponse.json({ success: true });
  clearAuthCookie(res);
  return res;
}
