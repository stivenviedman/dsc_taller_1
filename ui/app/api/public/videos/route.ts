import { NextResponse } from "next/server";

const BASE = process.env.API_BASE_URL || "http://127.0.0.1:8080";

export async function GET() {
  try {
    const response = await fetch(`${BASE}/api/public/videos`, {
      cache: "no-store",
    });

    const data = await response.text();

    // Log the raw response data for debugging purposes
    console.log("Raw Response Data:", data.substring(0, 200) + (data.length > 200 ? '...' : '')); 

    const jsonData = data ? JSON.parse(data) : {};

    if (!response.ok) {
      // Log non-2xx status errors from the upstream API
      console.error("Upstream API Error:", response.status, jsonData); 
      return NextResponse.json(
        { message: jsonData?.message || "Failed to fetch videos" },
        { status: response.status }
      );
    }

    return NextResponse.json(jsonData);
  } catch (error) {
    // Log the specific error that occurred during fetch or JSON parsing
    console.error("Next.js Server Error:", error); 

    // Re-throw the error (optional) or just return the generic response
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}