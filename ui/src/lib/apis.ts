const BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8080";

type FetchOpts = {
  method?: "GET" | "POST" | "DELETE";
  token?: string | null;
  body?: any;
  isFormData?: boolean;
};

async function request<T>(path: string, opts: FetchOpts = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (!opts.isFormData) headers["Content-Type"] = "application/json";
  if (opts.token) headers["Authorization"] = `Bearer ${opts.token}`;

  const res = await fetch(`${BASE}${path}`, {
    method: opts.method || "GET",
    headers,
    body: opts.isFormData
      ? opts.body
      : opts.body
      ? JSON.stringify(opts.body)
      : undefined,
    cache: "no-store",
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : {};

  if (!res.ok) {
    const err = new Error((data?.message as string) || "Request failed");
    // @ts-ignore
    err.status = res.status;
    // @ts-ignore
    err.payload = data;
    throw err;
  }
  return data as T;
}

export const api = {
  signup: (body: any) => request("/api/auth/signup", { method: "POST", body }),
  login: (body: any) => request("/api/auth/login", { method: "POST", body }),
  uploadVideo: (token: string, file: File, title: string) => {
    const fd = new FormData();
    fd.append("video_file", file);
    fd.append("title", title);
    return request("/api/create_video", {
      method: "POST",
      token,
      body: fd,
      isFormData: true,
    });
  },
  publicVideos: () => request("/api/public/videos"),
  voteVideo: (token: string, id: number) =>
    request(`/api/public/videos/${id}/vote`, { method: "POST", token }),
  myVideos: (token: string) => request("/api/video", { token }),
  deleteVideo: (token: string, id: number) =>
    request(`/api/videos/${id}`, { method: "DELETE", token }),
  rankings: () => request("/api/public/rankings"),
};
