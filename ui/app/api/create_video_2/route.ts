import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const BASE = process.env.API_BASE_URL || "http://127.0.0.1:8080";
const VIDEO_DIR = path.join(process.cwd(), "public", "videos");
const VIDEO_FILES = ["video1.mp4", "video2.mp4"];

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get("authorization");

    if (!token) {
      return NextResponse.json(
        { message: "Authorization token required" },
        { status: 401 }
      );
    }

    const randomVideo =
      VIDEO_FILES[Math.floor(Math.random() * VIDEO_FILES.length)];
    const filePath = path.join(VIDEO_DIR, randomVideo);

    // Check if file exists
    try {
      await fs.access(filePath);
      console.log(`✅ File exists: ${filePath}`);
    } catch (error) {
      console.error(`❌ File does not exist: ${filePath}`);
      return NextResponse.json(
        { message: `Video file not found: ${randomVideo}` },
        { status: 400 }
      );
    }

    // Read the file as a buffer
    const fileBuffer = await fs.readFile(filePath);

    // Create a Blob from the buffer
    const blob = new Blob([fileBuffer as any], { type: "video/mp4" });

    // Create FormData using the Web API
    const formData = new FormData();
    formData.append("video_file", blob, randomVideo);
    formData.append("title", randomVideo);

    console.log(`📤 Uploading ${randomVideo} (${fileBuffer.length} bytes)`);

    const response = await fetch(`${BASE}/api/create_video`, {
      method: "POST",
      headers: {
        Authorization: token,
        // Don't manually set Content-Type - let fetch handle it with the boundary
      },
      body: formData,
    });

    console.log("response status:", response.status);
    console.log("response statusText:", response.statusText);

    const data = await response.text();

    let jsonData: any = {};
    try {
      if (response.headers.get("content-type")?.includes("application/json")) {
        jsonData = JSON.parse(data);
      } else {
        jsonData = { message: data };
      }
    } catch {
      jsonData = { message: data };
    }

    if (!response.ok) {
      return NextResponse.json(jsonData, { status: response.status });
    }

    return NextResponse.json(jsonData);
  } catch (error) {
    console.error("Error redirecting video creation:", error);
    return NextResponse.json(
      { message: "Internal server error", error: String(error) },
      { status: 500 }
    );
  }
}
