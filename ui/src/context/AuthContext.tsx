"use client";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { TokenBundle } from "@/lib/types";

type AuthState = {
  token: string | null;
  expiresAt: number | null; // epoch ms
  email: string | null;
};

type AuthCtx = {
  token: string | null;
  isAuthed: boolean;
  email: string | null;
  login: (bundle: TokenBundle, email: string) => void;
  logout: () => void;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ token: null, expiresAt: null, email: null });

  useEffect(() => {
    const raw = localStorage.getItem("auth");
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as AuthState;
        if (parsed.expiresAt && parsed.expiresAt > Date.now()) {
          setState(parsed);
        } else {
          localStorage.removeItem("auth");
        }
      } catch {}
    }
  }, []);

  const login = (bundle: TokenBundle, email: string) => {
    const expiresAt = Date.now() + bundle.expires_in * 1000;
    const next = { token: bundle.token, expiresAt, email };
    setState(next);
    localStorage.setItem("auth", JSON.stringify(next));
  };

  const logout = () => {
    setState({ token: null, expiresAt: null, email: null });
    localStorage.removeItem("auth");
  };

  const value = useMemo<AuthCtx>(
    () => ({
      token: state.token,
      email: state.email,
      isAuthed: Boolean(state.token && state.expiresAt && state.expiresAt > Date.now()),
      login,
      logout,
    }),
    [state]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used within AuthProvider");
  return v;
}
