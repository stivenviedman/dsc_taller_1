// app/api/auth/signup/route.ts
import { NextRequest, NextResponse } from "next/server";

const BASE = process.env.API_BASE_URL || "http://127.0.0.1:8080";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Log the request for debugging
    console.log("Signup request body:", JSON.stringify(body, null, 2));
    console.log("Backend URL:", `${BASE}/api/auth/signup`);

    const response = await fetch(`${BASE}/api/auth/signup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.text();
    let jsonData = {} as any;
    try {
      jsonData = data ? JSON.parse(data) : {};
    } catch (parseError) {
      console.error("Failed to parse backend response as JSON:", parseError);
      return NextResponse.json(
        { message: "Invalid response from backend server" },
        { status: 502 }
      );
    }

    if (!response.ok) {
      return NextResponse.json(
        { message: jsonData?.message || "Signup failed" },
        { status: response.status }
      );
    }

    return NextResponse.json(jsonData);
  } catch (error) {
    console.error("Signup API route error:", error);

    // More specific error handling
    if (error instanceof TypeError && error.message.includes("fetch")) {
      return NextResponse.json(
        { message: "Cannot connect to backend server" },
        { status: 502 }
      );
    }

    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
