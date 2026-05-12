import { NextRequest, NextResponse } from "next/server";

// GET /api/v1/omada — Proxy to Omada Controller (sites, devices, clients)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action"); // e.g. "sites", "devices", "clients"
    const siteId = searchParams.get("siteId");
    // TODO: Auth check, proxy request to Omada Controller via omada.service
    return NextResponse.json({ message: "Omada proxy", action, siteId, data: [] });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/v1/omada — Execute actions on Omada Controller
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // TODO: Actions: create-site, adopt-device, authorize-client, etc.
    return NextResponse.json({ message: "Omada action", data: body });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
