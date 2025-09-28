const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");

const BASE_URL = "http://localhost:8080";

// Test configuration
const TEST_USER = {
  first_name: "Test",
  last_name: "User",
  email: `test${Date.now()}@example.com`,
  password1: "1234",
  password2: "1234",
  city: "Cali",
  country: "Colombia",
  type: "player",
};

let authToken = null;
let testVideoId = null;

// Helper function to make API calls
async function apiCall(method, endpoint, data = null, headers = {}) {
  try {
    const config = {
      method,
      url: `${BASE_URL}${endpoint}`,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
    };

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    return { success: true, data: response.data, status: response.status };
  } catch (error) {
    return {
      success: false,
      error: error.response?.data || error.message,
      status: error.response?.status,
    };
  }
}

// 1. Test Signup
async function testSignup() {
  console.log("\n=== Testing Signup ===");
  const result = await apiCall("POST", "/api/auth/signup", TEST_USER);

  if (result.success) {
    console.log("✅ Signup successful");
    console.log("Token:", result.data.token);
    authToken = result.data.token;
    return true;
  } else {
    console.log("❌ Signup failed:", result.error);
    return false;
  }
}

// 2. Test Login
async function testLogin() {
  console.log("\n=== Testing Login ===");
  const loginData = {
    email: TEST_USER.email,
    password: TEST_USER.password1,
  };

  const result = await apiCall("POST", "/api/auth/login", loginData);

  if (result.success) {
    console.log("✅ Login successful");
    console.log("Token:", result.data.token);
    authToken = result.data.token;
    return true;
  } else {
    console.log("❌ Login failed:", result.error);
    return false;
  }
}

// FIXED Video Upload Test - Matching your Go backend expectations
async function testVideoUpload() {
  console.log("\n=== Testing Video Upload ===");

  // Check if test video file exists
  if (!fs.existsSync("./videos/video1.mp4")) {
    console.log("❌ Test video file not found: ./videos/video1.mp4");
    console.log("Current directory:", process.cwd());
    try {
      const files = fs.readdirSync("./videos");
      console.log("Files in videos directory:", files.join(", "));
    } catch (e) {
      console.log("Cannot read videos directory");
    }
    return false;
  }

  // Check file stats
  const stats = fs.statSync("./videos/video1.mp4");
  console.log(`Video file size: ${stats.size} bytes`);

  if (!authToken) {
    console.log("❌ No authentication token available");
    return false;
  }

  try {
    // Create form data EXACTLY as your Go backend expects
    const formData = new FormData();

    // These field names must match exactly what your Go code expects
    formData.append("title", `Test Video ${Date.now()}`);

    // Append the file with the exact field name "video_file"
    formData.append(
      "video_file",
      fs.createReadStream("./videos/video1.mp4"),
      "video1.mp4" // Original filename
    );

    console.log("Sending upload request to /api/create_video...");
    console.log("Form data fields:", ["title", "video_file"]);
    console.log("Auth token present:", !!authToken);

    const response = await axios.post(
      `${BASE_URL}/api/create_video`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
          ...formData.getHeaders(),
        },
        // Increase timeouts for file uploads
        timeout: 60000,
        maxContentLength: 100 * 1024 * 1024, // 100MB
        maxBodyLength: 100 * 1024 * 1024, // 100MB
      }
    );

    console.log("✅ Video upload successful!");
    console.log("Status:", response.status);
    console.log("Response message:", response.data.message);
    console.log("Task ID:", response.data.task_id);
    console.log("Video ID:", response.data.video?.id);
    console.log("Video status:", response.data.video?.status);
    console.log("Video original URL:", response.data.video?.originalUrl);

    testVideoId = response.data.video?.id;
    return true;
  } catch (error) {
    console.log("❌ Video upload failed");

    if (error.response) {
      console.log("HTTP Status:", error.response.status);
      console.log(
        "Response data:",
        JSON.stringify(error.response.data, null, 2)
      );

      // Specific error messages from your Go code
      if (error.response.status === 400) {
        console.log("❌ Bad Request - Missing video file or invalid data");
      } else if (error.response.status === 500) {
        console.log("❌ Internal Server Error - Check server logs");
      }
    } else if (error.request) {
      console.log("❌ No response received - Network issue or server down");
      console.log("Request was made but no response received");
    } else {
      console.log("❌ Error setting up request:", error.message);
    }

    return false;
  }
}

// Test with a smaller file first
async function testVideoUploadWithSmallFile() {
  console.log("\n=== Testing Video Upload with Small File ===");

  // Create a small test file if it doesn't exist
  const smallVideoPath = "./videos/small_test.mp4";
  if (!fs.existsSync(smallVideoPath)) {
    console.log("Creating small test file...");
    // Create a minimal MP4 header (this won't be a real video but will test the upload)
    const minimalMp4 = Buffer.from([
      0x00,
      0x00,
      0x00,
      0x18,
      0x66,
      0x74,
      0x79,
      0x70, // ftyp
      0x6d,
      0x70,
      0x34,
      0x32,
      0x00,
      0x00,
      0x00,
      0x00, // mp42
      0x6d,
      0x70,
      0x34,
      0x32,
      0x6d,
      0x70,
      0x34,
      0x31, // mp42mp41
    ]);
    fs.writeFileSync(smallVideoPath, minimalMp4);
  }

  try {
    const formData = new FormData();
    formData.append("title", `Small Test Video ${Date.now()}`);
    formData.append(
      "video_file",
      fs.createReadSync(smallVideoPath),
      "small_test.mp4"
    );

    const response = await axios.post(
      `${BASE_URL}/api/create_video`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
          ...formData.getHeaders(),
        },
        timeout: 30000,
      }
    );

    console.log("✅ Small video upload successful!");
    console.log("Response:", response.data);
    return true;
  } catch (error) {
    console.log(
      "❌ Small video upload failed:",
      error.response?.data || error.message
    );
    return false;
  }
}

// Test Get My Videos
async function testGetMyVideos() {
  console.log("\n=== Testing Get My Videos ===");
  const result = await apiCall("GET", "/api/videos", null, {
    Authorization: `Bearer ${authToken}`,
  });

  if (result.success) {
    console.log("✅ Get my videos successful");
    console.log("My videos count:", result.data.data?.length || 0);
    if (result.data.data && result.data.data.length > 0) {
      console.log("Latest video:", result.data.data[0]);
    }
    return true;
  } else {
    console.log("❌ Get my videos failed:", result.error);
    return false;
  }
}

// Test Get Public Videos
async function testGetPublicVideos() {
  console.log("\n=== Testing Get Public Videos ===");
  const result = await apiCall("GET", "/api/public/videos");

  if (result.success) {
    console.log("✅ Get public videos successful");
    console.log("Videos count:", result.data.data?.length || 0);
    return true;
  } else {
    console.log("❌ Get public videos failed:", result.error);
    return false;
  }
}

// Test Get Rankings
async function testGetRankings() {
  console.log("\n=== Testing Get Rankings ===");
  const result = await apiCall("GET", "/api/public/rankings");

  if (result.success) {
    console.log("✅ Get rankings successful");
    console.log("Rankings count:", result.data.data?.length || 0);
    return true;
  } else {
    console.log("❌ Get rankings failed:", result.error);
    return false;
  }
}

// Main test runner focused on video upload debugging
async function debugVideoUpload() {
  console.log("🔧 Debugging Video Upload...\n");

  // Test authentication first
  let authSuccess = await testSignup();
  if (!authSuccess) {
    console.log("🔄 Signup failed, trying login...");
    TEST_USER.email = "test@example.com"; // Use existing user
    authSuccess = await testLogin();
  }

  if (!authSuccess) {
    console.log("❌ Cannot proceed - authentication failed");
    return;
  }

  console.log("\n--- Testing Video Upload ---");

  // First try with regular video
  const uploadSuccess = await testVideoUpload();

  if (!uploadSuccess) {
    console.log("\n--- Trying with Small Test File ---");
    await testVideoUploadWithSmallFile();
  }

  // Check if videos appear in the list
  console.log("\n--- Checking Uploaded Videos ---");
  await testGetMyVideos();

  console.log("\n--- Checking Public Videos ---");
  await testGetPublicVideos();
}

// Run the debug
debugVideoUpload().catch(console.error);
