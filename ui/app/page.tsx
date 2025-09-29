"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/apis";
import { PublicVideo } from "@/lib/types";
import VideoCard from "@/components/VideoCard";

export default function HomePage() {
  const [videos, setVideos] = useState<PublicVideo[]>([]);
  const [loading, setLoading] = useState(true);

  // const load = async () => {
  //   setLoading(true);
  //   try {
  //     const res = await api.publicVideos() as any;
  //     setVideos(res.data as PublicVideo[]);
  //   } catch (e: any) {
  //     alert(e?.message || "Error cargando videos públicos");
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  // useEffect(() => {
  //   load();
  // }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Videos públicos</h1>
      {/* {loading ? (
        <div className="opacity-70">Cargando...</div>
      ) : videos.length === 0 ? (
        <div className="opacity-70">No hay videos disponibles todavía.</div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          {videos.map((v) => (
            <VideoCard key={v.id} v={v} onVoted={load} />
          ))}
        </div>
      )} */}
    </div>
  );
}
