"use client";
import { useState } from "react";
import { api } from "@/lib/apis";
import { useAuth } from "@/context/AuthContext";
import FormField from "@/components/FormField";
import { useRouter } from "next/navigation";
import type { LoginBody, TokenBundle } from "@/lib/types";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [form, setForm] = useState<LoginBody>({ email: "", password: "" });
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = (await api.login(form)) as TokenBundle & { message: string };
      login(res, form.email);
      router.replace("/");
    } catch (e: any) {
      alert(e?.message || "Credenciales inválidas");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-6 text-2xl font-bold">Iniciar sesión</h1>
      <form onSubmit={submit} className="space-y-4">
        <FormField
          label="Email"
          type="email"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          required
        />
        <FormField
          label="Contraseña"
          type="password"
          value={form.password}
          onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          required
        />
        <button
          className="w-full rounded-xl bg-emerald-600 px-4 py-2 font-semibold hover:bg-emerald-700 disabled:opacity-50"
          disabled={loading}
        >
          {loading ? "Ingresando..." : "Ingresar"}
        </button>
      </form>
    </div>
  );
}
