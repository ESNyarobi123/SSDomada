import { NextRequest } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { verifyReseller, apiSuccess, apiError, logResellerAction, getClientIp } from "@/server/middleware/reseller-auth";
import { checkFeatureAccess } from "@/server/services/reseller-plan-access.service";

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = new Map<string, string>([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/jpg", "jpg"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
]);

/**
 * POST /api/v1/reseller/captive-portal/asset
 * Multipart: fields `kind` (logo | bgImage) and `file` (image).
 * Returns `{ url }` — same-origin path under /uploads/captive/…
 */
export async function POST(req: NextRequest) {
  const ctx = await verifyReseller(req);
  if (ctx instanceof Response) return ctx;

  const featureGate = await checkFeatureAccess(ctx.resellerId, "customBranding");
  if (!featureGate.ok) {
    return apiError(featureGate.message, featureGate.statusCode, featureGate.code);
  }

  try {
    const form = await req.formData();
    const kind = form.get("kind");
    const file = form.get("file");

    if (kind !== "logo" && kind !== "bgImage") {
      return apiError("Invalid kind (use logo or bgImage)", 400);
    }
    if (!(file instanceof Blob)) {
      return apiError("Missing file", 400);
    }

    const mime = (file as File).type || "application/octet-stream";
    const ext = ALLOWED.get(mime);
    if (!ext) {
      return apiError("Unsupported image type (PNG, JPEG, WebP, GIF only)", 415);
    }
    if (file.size > MAX_BYTES) {
      return apiError("File too large (max 2 MB)", 413);
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const id = crypto.randomUUID();
    const filename = `${id}.${ext}`;
    const relDir = path.join("public", "uploads", "captive", ctx.resellerId);
    const absDir = path.join(process.cwd(), relDir);
    await mkdir(absDir, { recursive: true });
    const absPath = path.join(absDir, filename);
    await writeFile(absPath, buf);

    const publicUrl = `/api/public/captive/${ctx.resellerId}/${filename}`;

    await logResellerAction(ctx.userId, "captive_portal.asset_uploaded", "CaptivePortalConfig", ctx.resellerId, { kind, publicUrl }, getClientIp(req));

    return apiSuccess({ url: publicUrl, kind });
  } catch (e) {
    console.error("[CaptivePortalAsset POST]", e);
    return apiError("Upload failed", 500);
  }
}
