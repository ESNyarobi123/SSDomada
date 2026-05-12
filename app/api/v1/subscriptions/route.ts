import { NextRequest, NextResponse } from "next/server";

// GET /api/v1/subscriptions — List subscriptions
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");
    // TODO: Auth check, fetch subscriptions
    return NextResponse.json({ message: "List subscriptions", userId, data: [] });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/v1/subscriptions — Create subscription after payment
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // TODO: Create subscription, authorize client on Omada
    return NextResponse.json({ message: "Create subscription", data: body }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
