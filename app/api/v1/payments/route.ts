import { NextRequest, NextResponse } from "next/server";

// GET /api/v1/payments — List payments (filtered by reseller or user)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const resellerId = searchParams.get("resellerId");
    // TODO: Auth check, fetch payments
    return NextResponse.json({ message: "List payments", resellerId, data: [] });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/v1/payments — Initiate a payment (Paystack/Stripe)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // TODO: Initialize payment with provider, create payment record
    return NextResponse.json({ message: "Initiate payment", data: body }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
