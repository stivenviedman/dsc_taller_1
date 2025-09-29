// This single route will handle all static file proxying (videos, images, etc.)
import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.API_BASE_URL || "http://backend:8080";

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const filePath = "/" + params.path.join("/");
    const backendFileUrl = `http://10.0.1.93${filePath}`;

    console.log("Proxying file request:", backendFileUrl);

    // Forward all headers from the client (including Range for video streaming)
    const forwardHeaders: HeadersInit = {};

    // Headers that should be forwarded to the backend
    const headersToForward = [
      "range",
      "if-range",
      "if-modified-since",
      "if-none-match",
      "cache-control",
      "accept",
      "accept-encoding",
      "user-agent",
    ];

    headersToForward.forEach((header) => {
      const value = request.headers.get(header);
      if (value) {
        forwardHeaders[header] = value;
      }
    });

    // Make request to backend
    const response = await fetch(backendFileUrl, {
      method: "GET",
      headers: forwardHeaders,
    });

    console.log("backendFileUrl:: ", backendFileUrl);

    if (!response.ok) {
      console.log(`File not found: ${backendFileUrl} (${response.status})`);
      return new NextResponse("File not found", { status: response.status });
    }

    // Headers to copy from backend response
    const responseHeaders = new Headers();

    const headersToProxy = [
      "content-type",
      "content-length",
      "content-range",
      "accept-ranges",
      "cache-control",
      "last-modified",
      "etag",
      "expires",
      "content-encoding",
      "content-disposition",
    ];

    headersToProxy.forEach((header) => {
      const value = response.headers.get(header);
      if (value) {
        responseHeaders.set(header, value);
      }
    });

    // Ensure proper CORS headers if needed
    responseHeaders.set("Access-Control-Allow-Origin", "*");
    responseHeaders.set("Access-Control-Allow-Methods", "GET");

    // Handle streaming response
    const body = response.body;

    return new NextResponse(body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("Proxy error:", error);

    // More specific error handling
    if (error instanceof TypeError && error.message.includes("fetch")) {
      return new NextResponse("Backend server unavailable", { status: 502 });
    }

    return new NextResponse("Internal server error", { status: 500 });
  }
}

export async function HEAD(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    const filePath = "/" + params.path.join("/");
    const backendFileUrl = `${BACKEND_URL}${filePath}`;

    const response = await fetch(backendFileUrl, {
      method: "HEAD",
    });

    const responseHeaders = new Headers();

    const headersToProxy = [
      "content-type",
      "content-length",
      "accept-ranges",
      "cache-control",
      "last-modified",
      "etag",
    ];

    headersToProxy.forEach((header) => {
      const value = response.headers.get(header);
      if (value) {
        responseHeaders.set(header, value);
      }
    });

    return new NextResponse(null, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("Proxy HEAD error:", error);
    return new NextResponse(null, { status: 500 });
  }
}
