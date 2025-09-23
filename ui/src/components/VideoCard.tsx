"use client";
import { useState } from "react";
import { PublicVideo } from "@/lib/types";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/apis";

export default function VideoCard({
  v,
  onVoted,
}: {
  v: PublicVideo;
  onVoted?: () => void;
}) {
  const { token, isAuthed } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const src = v.processedUrl || v.originalUrl;

  // Now videos go through Next.js proxy route
  const videoUrl = `/api/proxy${src}`;

  const vote = async () => {
    if (!isAuthed || !token) return alert("Debes iniciar sesión para votar.");
    setSubmitting(true);
    try {
      await api.voteVideo(token, v.id);
      onVoted?.();
      alert("Voto registrado con éxito");
    } catch (e: any) {
      if (e?.status === 409) {
        alert(e?.message || "Ya votaste por este video");
      } else {
        alert(e?.message || "No se pudo votar");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="mb-2 text-sm text-white/60">
        {v.User?.firstName} {v.User?.lastName} · {v.User?.city ?? ""}
        {v.User?.city ? " · " : ""}
        {v.status}
      </div>
      <div className="aspect-video overflow-hidden rounded-xl border border-white/10 bg-black">
        <video
          src={videoUrl}
          controls
          className="h-full w-full"
          preload="metadata"
          onError={(e) => {
            console.error("Video load error:", e);
            console.error("Video URL:", videoUrl);
          }}
        />
      </div>
      <div className="mt-3 flex items-center justify-between">
        <div className="font-medium">{v.title}</div>
        <button
          onClick={vote}
          disabled={submitting}
          className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50"
        >
          {submitting ? "Votando..." : "Votar"}
        </button>
      </div>
    </div>
  );
}
