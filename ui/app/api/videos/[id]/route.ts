import { NextRequest, NextResponse } from "next/server";

const BASE = process.env.API_BASE_URL || "http://127.0.0.1:8080";

export async function DELETE(
  request: NextRequest,
  { params }: any
) {
  try {
    const token = request.headers.get("authorization");

    if (!token) {
      return NextResponse.json(
        { message: "Authorization token required" },
        { status: 401 }
      );
    }

    const { id } = params;

    const response = await fetch(`${BASE}/api/videos/${id}`, {
      method: "DELETE",
      headers: {
        Authorization: token,
      },
    });

    const data = await response.text();
    const jsonData = data ? JSON.parse(data) : {};

    if (!response.ok) {
      return NextResponse.json(
        { message: jsonData?.message || "Delete failed" },
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
