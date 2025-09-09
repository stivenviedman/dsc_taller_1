"use client";
import Protected from "@/components/Protected";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/apis";
import { useState } from "react";

export default function UploadPage() {
  return (
    <Protected>
      <UploadInner />
    </Protected>
  );
}

function UploadInner() {
  const { token } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    if (!file) return alert("Selecciona un archivo de video");
    if (!title.trim()) return alert("Agrega un título");

    setLoading(true);
    try {
      const res = await api.uploadVideo(token, file, title) as any;
      alert(`${res?.message || "Subido"}\nTarea: ${res?.task_id ?? "N/A"}`);
      setFile(null);
      setTitle("");
    } catch (e: any) {
      alert(e?.message || "No se pudo subir el video");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-4 text-2xl font-bold">Subir video de prueba</h1>
      <p className="mb-4 text-sm text-white/70">
        El procesamiento automático recorta a 30s, ajusta resolución/aspecto, agrega marca de agua ANB y elimina audio.
      </p>
      <form onSubmit={submit} className="space-y-4">
        <label className="grid gap-1">
          <span className="text-sm text-gray-200">Título</span>
          <input
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej: Crossover y tiro"
            required
          />
        </label>
        <label className="grid gap-1">
          <span className="text-sm text-gray-200">Archivo de video</span>
          <input
            type="file"
            accept="video/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="rounded-lg border border-dashed border-white/20 bg-white/5 px-3 py-2"
          />
        </label>
        <button
          className="w-full rounded-xl bg-emerald-600 px-4 py-2 font-semibold hover:bg-emerald-700 disabled:opacity-50"
          disabled={loading}
        >
          {loading ? "Subiendo..." : "Subir"}
        </button>
      </form>
    </div>
  );
}
