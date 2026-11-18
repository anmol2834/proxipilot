import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, company, teamSize, emailProvider, challenge } = body;

    if (!name || !email || !company) {
      return NextResponse.json(
        { error: "Name, work email, and company name are required." },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Please enter a valid work email address." },
        { status: 400 }
      );
    }

    const demoRef = `PP-DEMO-${Math.random().toString(36).substring(2, 8).toUpperCase()}-${Date.now().toString().slice(-4)}`;

    return NextResponse.json({
      success: true,
      bookingReference: demoRef,
      company,
      teamSize: teamSize || "1-10",
      emailProvider: emailProvider || "Google Workspace",
      message: "Demo request received! A product specialist will contact you within 24 hours with scheduled calendar options.",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to submit demo request. Please try again or email demo@proxipilot.com." },
      { status: 500 }
    );
  }
}
