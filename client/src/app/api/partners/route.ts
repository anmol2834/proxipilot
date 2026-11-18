import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, company, partnerType, website, details } = body;

    if (!name || !email || !company) {
      return NextResponse.json(
        { error: "Name, business email, and organization are required." },
        { status: 400 }
      );
    }

    const partnerRef = `PP-PARTNER-${Math.random().toString(36).substring(2, 8).toUpperCase()}-${Date.now().toString().slice(-4)}`;

    return NextResponse.json({
      success: true,
      partnerRef,
      partnerType: partnerType || "Technology Integration",
      message: "Thank you for your interest in partnering with ProxiPilot. Our alliances team will review your application within 2 business days.",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Error submitting partnership inquiry." },
      { status: 500 }
    );
  }
}
