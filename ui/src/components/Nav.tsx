"use client";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

export default function Nav() {
  const { isAuthed, email, logout } = useAuth();

  return (
    <nav className="sticky top-0 z-50 border-b bg-black text-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="font-bold">ANB Scout</Link>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/rankings" className="hover:underline">Rankings</Link>
          {isAuthed && (
            <>
              <Link href="/upload" className="hover:underline">Subir video</Link>
              <Link href="/my-videos" className="hover:underline">Mis videos</Link>
            </>
          )}
          {!isAuthed ? (
            <>
              <Link href="/login" className="rounded bg-white/10 px-3 py-1 hover:bg-white/20">Login</Link>
              <Link href="/signup" className="rounded bg-emerald-500 px-3 py-1">Registro</Link>
            </>
          ) : (
            <>
              <span className="hidden sm:inline text-white/80">{email}</span>
              <button
                onClick={logout}
                className="rounded bg-red-500 px-3 py-1 hover:bg-red-600"
              >
                Logout
              </button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
