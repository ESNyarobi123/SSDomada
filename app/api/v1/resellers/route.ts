import { NextRequest, NextResponse } from "next/server";

// GET /api/v1/resellers — List all resellers (Super Admin)
export async function GET(req: NextRequest) {
  try {
    // TODO: Auth check (Super Admin only)
    // TODO: Fetch resellers from DB
    return NextResponse.json({ message: "List resellers", data: [] });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/v1/resellers — Create a new reseller
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // TODO: Auth check (Super Admin only)
    // TODO: Create reseller + Omada site
    return NextResponse.json({ message: "Create reseller", data: body }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
