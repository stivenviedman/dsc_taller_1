// This command must be executed in the following way
// k6 run -e BASE_URL=http://internal-BackendELB-339079899.us-east-1.elb.amazonaws.com:8080 -e TOTAL_STEPS=20 -e VUS_INCREMENT=100 -e STEP_DURATION=1m load_tests.js
import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Counter, Rate } from "k6/metrics";

// Custom metrics
const videoUploadSuccessRate = new Rate("video_upload_success_rate");

// Scenario-specific counters
const scenarioCounter = new Counter("scenario_count");
const usersCreated = new Counter("users_created");
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
  // Add these to reduce memory usage
  discardResponseBodies: true,  // Don't store response bodies in memory
  batch: 10,  // Reduce batch size for metric aggregation
  batchPerHost: 5,  // Limit concurrent connections per host
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

function generateRandomString(length = 8) {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function testVideoDownloads() {
  if (Math.random() > 0.1) return;

  const resp = http.get(`${BASE_URL}/api/public/videos`);
  const videos = resp.json("data");

  const validVideos = videos?.filter(
    (video) => video?.status === "processed" && video?.processedUrl?.length > 0
  );

  if (validVideos && validVideos.length > 0) {
    const randomVideo =
      validVideos[Math.floor(Math.random() * validVideos.length)];

    if (randomVideo.status === "processed" && randomVideo.processedUrl) {
      const downloadUrl = `${randomVideo.processedUrl}`;
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
  const videos = [
    "https://anb-123.s3.us-east-1.amazonaws.com/uploads/1_1_1_asdfasdsdf.mp4",
  ]

  const authHeaders = {
    ...headers,
    Authorization: `Bearer ${token}`,
  };

  if (Math.random() < 0.5) {
    // Pick a random video URL from the array
    const videoURL = videos[Math.floor(Math.random() * videos.length)];
    const title = `Test Video ${Math.floor(Math.random() * 10000)}`;

    const body = {
      video_url: videoURL,
      title: title,
    };

    const uploadStart = Date.now();
    const uploadResp = http.post(
      `${BASE_URL}/api/create_video_test`,
      body,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        timeout: "60s",
      }
    );
    const uploadTime = Date.now() - uploadStart;

    videoUploadResponseTime.add(uploadTime);

    const uploadSuccess = check(uploadResp, {
      "Video upload successful": (r) => r.status === 200,
      "Video upload returns task_id": (r) => r.json("task_id") !== undefined,
      "Video upload returns video id": (r) => r.json("video.id") !== undefined,
    });

    videoUploadSuccessRate.add(uploadSuccess);
  }

  // Fetch user's videos
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
