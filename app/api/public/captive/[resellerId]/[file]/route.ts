import { readFile } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

const FILE_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|jpeg|webp|gif)$/i;
const RESELLER_RE = /^c[a-z0-9]{24}$/;

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

/**
 * GET /api/public/captive/[resellerId]/[file]
 * Serves reseller-uploaded captive portal assets from disk (public/uploads/captive/...).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ resellerId: string; file: string }> }
) {
  const { resellerId, file } = await params;

  if (!RESELLER_RE.test(resellerId) || !FILE_RE.test(file)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const safeBase = path.join(process.cwd(), "public", "uploads", "captive", resellerId);
  const abs = path.join(safeBase, path.basename(file));
  if (!abs.startsWith(safeBase)) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const buf = await readFile(abs);
    const ext = file.split(".").pop()?.toLowerCase() || "bin";
    const contentType = MIME[ext] || "application/octet-stream";
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
