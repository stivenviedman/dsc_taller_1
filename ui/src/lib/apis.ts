export const BASE = "/api";

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

  const res = await fetch(`/api${path}`, {
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
  signup: (body: any) => request("/auth/signup", { method: "POST", body }),
  login: (body: any) => request("/auth/login", { method: "POST", body }),
  uploadVideo: (token: string, file: File, title: string) => {
    const fd = new FormData();
    fd.append("video_file", file);
    fd.append("title", title);
    return request("/create_video", {
      method: "POST",
      token,
      body: fd,
      isFormData: true,
    });
  },
  publicVideos: () => request("/public/videos"),
  voteVideo: (token: string, id: number) =>
    request(`/public/videos/${id}/vote`, { method: "POST", token }),
  myVideos: (token: string) => request("/videos", { token }),
  deleteVideo: (token: string, id: number) =>
    request(`/videos/${id}`, { method: "DELETE", token }),
  rankings: () => request("/public/rankings"),
};
