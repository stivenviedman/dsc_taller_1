// This command must be executed in the following way
// k6 run -e BASE_URL=http://localhost:8080 -e TOTAL_STEPS=3 -e VUS_INCREMENT=5 -e STEP_DURATION=30s -e VIDEO_ASSETS_URL=http://localhost:8080 load_tests.js
// k6 run -e BASE_URL=http://10.0.1.32:8080 -e TOTAL_STEPS=10 -e VUS_INCREMENT=1000 -e STEP_DURATION=5m -e VIDEO_ASSETS_URL=http://http://10.0.1.93 load_tests.js
import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Counter, Rate } from "k6/metrics";

// Custom metrics
const videoUploadSuccessRate = new Rate("video_upload_success_rate");

// Scenario-specific counters
const scenarioCounter = new Counter("scenario_count");
const usersCreated = new Counter("users_created");
const videosUploaded = new Counter("videos_uploaded");
const votesCast = new Counter("votes_cast");

// Endpoint-specific response time trends
const authResponseTime = new Trend("auth_response_time");
const videoUploadResponseTime = new Trend("video_upload_response_time");
const voteResponseTime = new Trend("vote_response_time");
const publicVideosResponseTime = new Trend("public_videos_response_time");
const rankingsResponseTime = new Trend("rankings_response_time");
const myVideosResponseTime = new Trend("my_videos_response_time");
const videoDownloadResponseTime = new Trend("video_download_response_time");

// Environment-configurable variables
const BASE_URL = __ENV.BASE_URL || "http://127.0.0.1:8080";
const TOTAL_STEPS = parseInt(__ENV.TOTAL_STEPS || "100", 10); // how many increments
const VUS_INCREMENT = parseInt(__ENV.VUS_INCREMENT || "500", 10); // how many users to add each step
const STEP_DURATION = __ENV.STEP_DURATION || "5m"; // how long each step lasts
const VIDEO_ASSETS_URL = __ENV.VIDEO_ASSETS_URL || BASE_URL;

const stages = [];
for (let i = 1; i <= TOTAL_STEPS; i++) {
  stages.push({ duration: STEP_DURATION, target: i * VUS_INCREMENT });
}

export const options = {
  scenarios: {
    stress: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: stages,
    },
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
const videoBuffers = videoFiles.map((filename) => {
  try {
    const file = open(`./videos/${filename}`, "b");
    return { filename, buffer: file };
  } catch (error) {
    console.error(`Failed to load ${filename}: ${error.message}`);
    return null;
  }
}).filter(Boolean);

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
  return { videoBuffers: videoBuffers.length };
}

function testVideoDownloads() {
  const resp = http.get(`${BASE_URL}/api/public/videos`);
  const videos = resp.json("data");

  const validVideos = videos?.filter(video => video?.status === "processed" && video?.processedUrl?.length > 0)

  if (validVideos && validVideos.length > 0) {
    const randomVideo = validVideos[Math.floor(Math.random() * validVideos.length)];
    
    if (randomVideo.status === "processed" && randomVideo.processedUrl) {
      const downloadUrl = `${VIDEO_ASSETS_URL}${randomVideo.processedUrl}`;
      const start = Date.now();
      const downloadResp = http.get(downloadUrl, { timeout: "60s" });
      videoDownloadResponseTime.add(Date.now() - start);

      check(downloadResp, {
        "processed video download is 200": (r) => r.status === 200,
      });
    }
  }
}

function testPublicEndpoints() {
  // Track public videos response time
  const publicVideosStart = Date.now();
  const publicVideosResp = http.get(`${BASE_URL}/api/public/videos`);
  publicVideosResponseTime.add(Date.now() - publicVideosStart);

  check(publicVideosResp, {
    "GET /api/public/videos returns 200": (r) => r.status === 200,
    "GET /api/public/videos has data": (r) => r.json("data") !== undefined,
  });

  // Track rankings response time
  const rankingsStart = Date.now();
  const rankingsResp = http.get(`${BASE_URL}/api/public/rankings`);
  rankingsResponseTime.add(Date.now() - rankingsStart);

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

  const startTime = Date.now();
  const loginResp = http.post(`${BASE_URL}/api/auth/login`, loginPayload, {
    headers,
  });
  const responseTime = Date.now() - startTime;

  authResponseTime.add(responseTime);

  const loginSuccess = check(loginResp, {
    "Login successful": (r) => r.status === 200,
    "Login returns token": (r) => r.json("token") !== undefined,
  });

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
    usersCreated.add(1);
    return signupResp.json("token");
  }

  return null;
}

function testAuthenticatedEndpoints(token) {
  const authHeaders = {
    ...headers,
    Authorization: `Bearer ${token}`,
  };

  const myVideosStart = Date.now();
  const myVideosResp = http.get(`${BASE_URL}/api/videos`, {
    headers: authHeaders,
  });
  myVideosResponseTime.add(Date.now() - myVideosStart);

  check(myVideosResp, {
    "GET /api/videos returns 200": (r) => r.status === 200,
    "GET /api/videos has user videos": (r) => r.json("data") !== undefined,
  });
}

function voterScenario(token) {
  scenarioCounter.add(1, { scenario: "voter" });

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

      const voteStart = Date.now();
      const voteResp = http.post(
        `${BASE_URL}/api/public/videos/${randomVideo.id}/vote`,
        null,
        { headers: authHeaders }
      );
      voteResponseTime.add(Date.now() - voteStart);

      if (voteResp.status === 201) {
        votesCast.add(1);
      } else if (voteResp.status === 409) {
        console.log(`Already voted for video ${randomVideo.id} (expected)`);
      } else {
        console.log(`Vote failed with status: ${voteResp.status}`);
      }
    }
  }
}

function basketballPlayerScenario(token) {
  scenarioCounter.add(1, { scenario: "basketball_player" });

  const authHeaders = {
    ...headers,
    Authorization: `Bearer ${token}`,
  };

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

    const uploadStart = Date.now();
    const uploadResp = http.post(`${BASE_URL}/api/create_video`, formData, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      timeout: "60s",
    });
    const uploadTime = Date.now() - uploadStart;

    videoUploadResponseTime.add(uploadTime);

    const uploadSuccess = check(uploadResp, {
      "Video upload successful": (r) => r.status === 200,
      "Video upload returns task_id": (r) => r.json("task_id") !== undefined,
      "Video upload returns video id": (r) => r.json("video.id") !== undefined,
    });

    videoUploadSuccessRate.add(uploadSuccess);

    if (uploadSuccess) {
      videosUploaded.add(1);
      console.log(
        `✅ Uploaded: ${videoTitle} (${randomizedFilename}) in ${uploadTime}ms`
      );
    } else {
      console.log(`❌ Upload failed: ${uploadResp.status} in ${uploadTime}ms`);
      console.log(`   Response: ${uploadResp.body}`);

      if (uploadResp.status === 400) {
        console.log(`❌ Error: Missing video file or invalid data`);
      } else if (uploadResp.status === 500) {
        console.log(`❌ Error: Server error - check backend logs`);
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
    console.log(`User has ${myVideosResp.json("data").length} videos`);
  }
}

function newUserScenario() {
  scenarioCounter.add(1, { scenario: "new_user" });

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
    usersCreated.add(1);
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

export default function () {
  testPublicEndpoints();
  testVideoDownloads();

  const token = authenticateUser();
  if (token) {
    testAuthenticatedEndpoints(token);

    const scenario = Math.random();
    if (scenario < 0.4) {
      voterScenario(token); // 40% de los casos
    } else if (scenario < 0.7) {
      basketballPlayerScenario(token); // 30% de los casos
    } else {
      newUserScenario(); // 30% de los casos
    }
  }

  sleep(1);
}

export function teardown() {}
