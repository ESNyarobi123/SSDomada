import { NextRequest, NextResponse } from "next/server";

// GET /api/v1/sites — List sites (filtered by reseller)
export async function GET(req: NextRequest) {
  try {
    // TODO: Auth check, filter by resellerId
    return NextResponse.json({ message: "List sites", data: [] });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/v1/sites — Create a new Omada site
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // TODO: Create site in DB + Omada Controller
    return NextResponse.json({ message: "Create site", data: body }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
