import { NextRequest, NextResponse } from "next/server";

const BASE = process.env.API_BASE_URL || "http://127.0.0.1:8080";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const response = await fetch(`${BASE}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.text();
    const jsonData = data ? JSON.parse(data) : {};

    if (!response.ok) {
      return NextResponse.json(
        { message: jsonData?.message || "Login failed" },
        { status: response.status }
      );
    }

    return NextResponse.json(jsonData);
  } catch (error) {
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
