export type TokenBundle = {
  token: string;
  token_type: "Bearer" | string;
  expires_in: number;
};

export type SignupBody = {
  first_name: string;
  last_name: string;
  email: string;
  password1: string;
  password2: string;
  city: string;
  country: string;
  type: "player" | "fan" | string;
};

export type LoginBody = {
  email: string;
  password: string;
};

export type PublicVideo = {
  id: number;
  processedUrl: string | null;
  originalUrl: string;
  title: string;
  status: "uploaded" | "processing" | "processed" | string;
  createdAt: string;
  processedAt: string | null;
  user_id: number;
  User: {
    id: number;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    city: string | null;
    country: string | null;
    type: string | null;
  };
};

export type MyVideo = {
  video_id: number;
  title: string;
  status: string;
  uploaded_at: string;
  processed_at: string | null;
  processed_url: string | null;
};

export type RankingRow = {
  UserID: number;
  Email: string;
  City: string | null;
  Votes: number;
};
