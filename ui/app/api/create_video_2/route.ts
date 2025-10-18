import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const VIDEO_DIR = path.join(process.cwd(), "public", "videos");
const VIDEO_FILES = ["video1.mp4", "video2.mp4"];

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get("authorization");

    if (!token) {
      return NextResponse.json(
        { message: "Authorization token required" },
        { status: 401 }
      );
    }

    // Pick a random video
    const randomVideo =
      VIDEO_FILES[Math.floor(Math.random() * VIDEO_FILES.length)];
    const filePath = path.join(VIDEO_DIR, randomVideo);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { message: `Video file not found: ${randomVideo}` },
        { status: 404 }
      );
    }

    // Handle range requests (so the browser can stream properly)
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = request.headers.get("range");

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      const file = fs.createReadStream(filePath, { start, end });
      const headers = new Headers({
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunkSize.toString(),
        "Content-Type": "video/mp4",
      });

      return new NextResponse(file as any, {
        status: 206,
        headers,
      });
    } else {
      const file = fs.createReadStream(filePath);
      const headers = new Headers({
        "Content-Length": fileSize.toString(),
        "Content-Type": "video/mp4",
      });

      return new NextResponse(file as any, {
        status: 200,
        headers,
      });
    }
  } catch (error) {
    console.error("Error serving video:", error);
    return NextResponse.json(
      { message: "Internal server error", error: String(error) },
      { status: 500 }
    );
  }
}
