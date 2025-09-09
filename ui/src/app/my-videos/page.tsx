"use client";
import Protected from "@/components/Protected";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/apis";
import { MyVideo } from "@/lib/types";
import { useEffect, useState } from "react";

export default function MyVideosPage() {
  return (
    <Protected>
      <Inner />
    </Protected>
  );
}

function Inner() {
  const { token } = useAuth();
  const [rows, setRows] = useState<MyVideo[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await api.myVideos(token) as any;
      setRows(res.data as MyVideo[]);
    } catch (e: any) {
      alert(e?.message || "No se pudieron cargar tus videos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const del = async (id: number) => {
    if (!token) return;
    if (!confirm("¿Eliminar este video?")) return;
    try {
      await api.deleteVideo(token, id);
      await load();
      alert("Video eliminado");
    } catch (e: any) {
      alert(e?.message || "No se puede eliminar (ya procesado o con votos)");
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Mis videos</h1>
      {loading ? (
        <div className="opacity-70">Cargando...</div>
      ) : !rows?.length ? (
        <div className="opacity-70">Aún no has subido videos.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-white/5">
              <tr>
                <th className="px-3 py-2 text-left">ID</th>
                <th className="px-3 py-2 text-left">Título</th>
                <th className="px-3 py-2 text-left">Estado</th>
                <th className="px-3 py-2 text-left">Subido</th>
                <th className="px-3 py-2 text-left">Procesado</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.video_id} className="border-b border-white/10">
                  <td className="px-3 py-2">{r.video_id}</td>
                  <td className="px-3 py-2">{r.title}</td>
                  <td className="px-3 py-2">{r.status}</td>
                  <td className="px-3 py-2">{new Date(r.uploaded_at).toLocaleString()}</td>
                  <td className="px-3 py-2">
                    {r.processed_at ? new Date(r.processed_at).toLocaleString() : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => del(r.video_id)}
                      className="rounded-lg bg-red-600 px-3 py-1 hover:bg-red-700"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
