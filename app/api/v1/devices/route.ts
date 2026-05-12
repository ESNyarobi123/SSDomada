import { NextRequest, NextResponse } from "next/server";

// GET /api/v1/devices — List devices (filtered by reseller/site)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const siteId = searchParams.get("siteId");
    // TODO: Auth check, fetch devices from DB + sync with Omada
    return NextResponse.json({ message: "List devices", siteId, data: [] });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/v1/devices — Adopt / register a new device
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // TODO: Register device in DB + adopt on Omada Controller
    return NextResponse.json({ message: "Register device", data: body }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
