"use client";
import { useState } from "react";
import { api } from "@/lib/apis";
import { useAuth } from "@/context/AuthContext";
import FormField from "@/components/FormField";
import { useRouter } from "next/navigation";
import type { SignupBody, TokenBundle } from "@/lib/types";

export default function SignupPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [form, setForm] = useState<SignupBody>({
    first_name: "",
    last_name: "",
    email: "",
    password1: "",
    password2: "",
    city: "",
    country: "",
    type: "player",
  });
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password1 !== form.password2) return alert("Las contraseñas no coinciden");
    setLoading(true);
    try {
      const res = (await api.signup(form)) as TokenBundle & { message: string };
      login(res, form.email);
      router.replace("/");
    } catch (e: any) {
      alert(e?.message || "No se pudo crear la cuenta");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-6 text-2xl font-bold">Registro de jugador</h1>
      <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="Nombre" value={form.first_name}
          onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))} required />
        <FormField label="Apellido" value={form.last_name}
          onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))} required />
        <FormField label="Email" type="email" value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} required />
        <FormField label="Ciudad" value={form.city}
          onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
        <FormField label="País" value={form.country}
          onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))} />
        <label className="grid gap-1">
          <span className="text-sm text-gray-200">Tipo</span>
          <select
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white"
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
          >
            <option value="player">player</option>
            <option value="fan">fan</option>
          </select>
        </label>
        <FormField label="Contraseña" type="password" value={form.password1}
          onChange={(e) => setForm((f) => ({ ...f, password1: e.target.value }))} required />
        <FormField label="Confirmar contraseña" type="password" value={form.password2}
          onChange={(e) => setForm((f) => ({ ...f, password2: e.target.value }))} required />
        <div className="col-span-full">
          <button
            className="w-full rounded-xl bg-emerald-600 px-4 py-2 font-semibold hover:bg-emerald-700 disabled:opacity-50"
            disabled={loading}
          >
            {loading ? "Creando..." : "Crear cuenta"}
          </button>
        </div>
      </form>
    </div>
  );
}
