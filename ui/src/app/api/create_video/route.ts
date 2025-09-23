import { NextRequest, NextResponse } from "next/server";

const BASE = process.env.API_BASE_URL || "http://127.0.0.1:8080";

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get("authorization");

    if (!token) {
      return NextResponse.json(
        { message: "Authorization token required" },
        { status: 401 }
      );
    }

    const formData = await request.formData();

    const response = await fetch(`${BASE}/api/create_video`, {
      method: "POST",
      headers: {
        Authorization: token,
      },
      body: formData,
    });

    const data = await response.text();
    const jsonData = data ? JSON.parse(data) : {};

    if (!response.ok) {
      return NextResponse.json(
        { message: jsonData?.message || "Video upload failed" },
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
