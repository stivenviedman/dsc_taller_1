"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/apis";
import { RankingRow } from "@/lib/types";

export default function RankingsPage() {
  const [rows, setRows] = useState<RankingRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.rankings() as any;
      setRows(res.data as RankingRow[]);
    } catch (e: any) {
      alert(e?.message || "No se pudo cargar el ranking");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Ranking de jugadores</h1>
      {loading ? (
        <div className="opacity-70">Cargando...</div>
      ) : !rows?.length ? (
        <div className="opacity-70">Aún no hay votos.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-white/5">
              <tr>
                <th className="px-3 py-2 text-left">Pos</th>
                <th className="px-3 py-2 text-left">Jugador</th>
                <th className="px-3 py-2 text-left">Ciudad</th>
                <th className="px-3 py-2 text-left">Votos</th>
              </tr>
            </thead>
            <tbody>
              {rows
                .sort((a, b) => b.Votes - a.Votes)
                .map((r, i) => (
                  <tr key={r.UserID} className="border-b border-white/10">
                    <td className="px-3 py-2">{i + 1}</td>
                    <td className="px-3 py-2">{r.Email}</td>
                    <td className="px-3 py-2">{r.City ?? "—"}</td>
                    <td className="px-3 py-2 font-bold">{r.Votes}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
