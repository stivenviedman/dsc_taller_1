import http from "k6/http";
import { check, sleep } from "k6";
import { Rate } from "k6/metrics";

// Custom metrics
const voteSuccessRate = new Rate("vote_success_rate");
const authSuccessRate = new Rate("auth_success_rate");
const videoUploadSuccessRate = new Rate("video_upload_success_rate");

// TODO: get from environment variables
const BASE_URL = "http://127.0.0.1:8080";
const MODE = "LOCAL";

export const options = {
  stages:
    MODE === "LOCAL"
      ? [
          { duration: "30s", target: 5 },
          { duration: "1m", target: 10 },
          { duration: "1m", target: 20 },
        ]
      : [
          { duration: "2m", target: 10 },
          { duration: "5m", target: 50 },
          { duration: "5m", target: 200 },
          { duration: "10m", target: 500 },
        ],
  thresholds: {
    http_req_duration: ["p(95)<2000"],
    http_req_failed: ["rate<0.01"],
    auth_success_rate: ["rate>0.95"],
    vote_success_rate: ["rate>0.95"],
  },
};

const headers = {
  "Content-Type": "application/json",
};

const videoTitles = [
  "Basketball Dunk Compilation",
  "Streetball Highlights",
  "Three Point Contest",
  "Game Winning Shot",
  "Training Drills",
  "CrossOver Moves",
  "Alley Oop Moments",
  "Defensive Plays",
  "Fast Break Action",
  "Free Throw Practice",
];

// Load video files in INIT stage (global scope)
const videoFiles = ["video1.mp4", "video2.mp4"];
const videoBuffers = videoFiles
  .map((filename) => {
    try {
      const file = open(`./videos/${filename}`, "b");
      console.log(`Loaded: ${filename} (${file.length} bytes)`);
      return {
        filename: filename,
        buffer: file,
        size: file.length,
      };
    } catch (error) {
      console.error(`Failed to load ${filename}:`, error.message);
      return null;
    }
  })
  .filter(Boolean);

console.log(`Successfully loaded ${videoBuffers.length} video files`);

function generateRandomString(length = 8) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function setup() {
  console.log("Setup: Starting test with pre-loaded video files");
  return { videoBuffers: videoBuffers.length };
}

export default function (data) {
  testPublicEndpoints();

  const token = authenticateUser();
  if (token) {
    testAuthenticatedEndpoints(token);

    const scenario = Math.random();
    if (scenario < 0.4) {
      voterScenario(token);
    } else if (scenario < 0.7) {
      basketballPlayerScenario(token);
    } else {
      newUserScenario();
    }
  }

  sleep(1);
}

function testPublicEndpoints() {
  const publicVideosResp = http.get(`${BASE_URL}/api/public/videos`);
  check(publicVideosResp, {
    "GET /api/public/videos returns 200": (r) => r.status === 200,
    "GET /api/public/videos has data": (r) => r.json("data") !== undefined,
  });

  const rankingsResp = http.get(`${BASE_URL}/api/public/rankings`);
  check(rankingsResp, {
    "GET /api/public/rankings returns 200": (r) => r.status === 200,
    "GET /api/public/rankings has data": (r) => r.json("data") !== undefined,
  });
}

function authenticateUser() {
  const userIndex = __VU % 100;

  const loginPayload = JSON.stringify({
    email: `loadtest${userIndex}@example.com`,
    password: "1234",
  });

  const loginResp = http.post(`${BASE_URL}/api/auth/login`, loginPayload, {
    headers,
  });

  const loginSuccess = check(loginResp, {
    "Login successful": (r) => r.status === 200,
    "Login returns token": (r) => r.json("token") !== undefined,
  });

  authSuccessRate.add(loginSuccess);

  if (loginSuccess) {
    return loginResp.json("token");
  }

  return createAndAuthenticateUser(userIndex);
}

function createAndAuthenticateUser(userIndex) {
  const signupPayload = JSON.stringify({
    first_name: "LoadTest",
    last_name: `User${userIndex}`,
    email: `loadtest${userIndex}@example.com`,
    password1: "1234",
    password2: "1234",
    city: "Cali",
    country: "Colombia",
    type: "player",
  });

  const signupResp = http.post(`${BASE_URL}/api/auth/signup`, signupPayload, {
    headers,
  });

  const signupSuccess = check(signupResp, {
    "Signup successful": (r) => r.status === 200,
    "Signup returns token": (r) => r.json("token") !== undefined,
  });

  if (signupSuccess) {
    return signupResp.json("token");
  }

  return null;
}

function testAuthenticatedEndpoints(token) {
  const authHeaders = {
    ...headers,
    Authorization: `Bearer ${token}`,
  };

  const myVideosResp = http.get(`${BASE_URL}/api/videos`, {
    headers: authHeaders,
  });
  check(myVideosResp, {
    "GET /api/videos returns 200": (r) => r.status === 200,
    "GET /api/videos has user videos": (r) => r.json("data") !== undefined,
  });
}

function voterScenario(token) {
  const authHeaders = {
    ...headers,
    Authorization: `Bearer ${token}`,
  };

  const rankingsResp = http.get(`${BASE_URL}/api/public/rankings`);
  check(rankingsResp, {
    "Can view rankings": (r) => r.status === 200,
  });

  const publicVideosResp = http.get(`${BASE_URL}/api/public/videos`);
  const videosData = publicVideosResp.json("data");

  if (videosData && videosData.length > 0) {
    if (Math.random() < 0.5) {
      const randomVideo =
        videosData[Math.floor(Math.random() * videosData.length)];
      const voteResp = http.post(
        `${BASE_URL}/api/public/videos/${randomVideo.id}/vote`,
        null,
        { headers: authHeaders }
      );

      // Count HTTP 409 as "success" for our metrics since it's expected behavior
      voteSuccessRate.add(voteResp.status === 201 || voteResp.status === 409);

      if (voteResp.status === 409) {
        console.log(
          `User already voted for video ${randomVideo.id} - expected behavior`
        );
      }
    }
  }
}

function basketballPlayerScenario(token) {
  const authHeaders = {
    ...headers,
    Authorization: `Bearer ${token}`,
  };

  // Probability for local testing
  if (Math.random() < 0.5 && videoBuffers.length > 0) {
    const randomVideoIndex = Math.floor(Math.random() * videoBuffers.length);
    const randomTitleIndex = Math.floor(Math.random() * videoTitles.length);

    const videoFile = videoBuffers[randomVideoIndex];
    const videoTitle = videoTitles[randomTitleIndex];
    const randomString = generateRandomString(6);

    const originalName = videoFile.filename.replace(".mp4", "");
    const randomizedFilename = `${originalName}_${randomString}.mp4`;

    const formData = {
      video_file: http.file(videoFile.buffer, randomizedFilename, "video/mp4"),
      title: `${videoTitle} ${randomString}`,
    };

    console.log(`Attempting to upload: ${randomizedFilename}`);

    const uploadResp = http.post(`${BASE_URL}/api/create_video`, formData, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      timeout: "60s",
    });

    const uploadSuccess = check(uploadResp, {
      "Video upload successful": (r) => r.status === 200,
      "Video upload returns task_id": (r) => r.json("task_id") !== undefined,
      "Video upload returns video id": (r) => r.json("video.id") !== undefined,
    });

    videoUploadSuccessRate.add(uploadSuccess);

    if (uploadSuccess) {
      console.log(`✅ Uploaded: ${videoTitle} (${randomizedFilename})`);
      console.log(`   Task ID: ${uploadResp.json("task_id")}`);
      console.log(`   Video ID: ${uploadResp.json("video.id")}`);
    } else {
      console.log(`❌ Upload failed: ${uploadResp.status}`);
      console.log(`   Response: ${uploadResp.body}`);

      // Log specific error types
      if (uploadResp.status === 400) {
        console.log(`   Error: Missing video file or invalid data`);
      } else if (uploadResp.status === 500) {
        console.log(`   Error: Server error - check backend logs`);
      }
    }
  }

  const myVideosResp = http.get(`${BASE_URL}/api/videos`, {
    headers: authHeaders,
  });

  const videosCheck = check(myVideosResp, {
    "Can view my videos": (r) => r.status === 200,
    "My videos response has data": (r) => r.json("data") !== undefined,
  });

  if (videosCheck && myVideosResp.json("data")) {
    console.log(`📹 User has ${myVideosResp.json("data").length} videos`);
  }
}

function newUserScenario() {
  const randomString = generateRandomString(6);
  const newUser = {
    first_name: "New",
    last_name: `User${randomString}`,
    email: `newuser${randomString}@example.com`,
    password1: "1234",
    password2: "1234",
    city: "Cali",
    country: "Colombia",
    type: "voter",
  };

  const signupResp = http.post(
    `${BASE_URL}/api/auth/signup`,
    JSON.stringify(newUser),
    { headers }
  );

  if (signupResp.status === 200) {
    const token = signupResp.json("token");
    const authHeaders = {
      ...headers,
      Authorization: `Bearer ${token}`,
    };

    const publicVideosResp = http.get(`${BASE_URL}/api/public/videos`, {
      headers: authHeaders,
    });
    check(publicVideosResp, {
      "New user can browse videos": (r) => r.status === 200,
    });
  }
}

export function teardown(data) {
  console.log(
    `Teardown: Load test completed. Used ${data.videoBuffers} video files`
  );
}
