"use client";
import { InputHTMLAttributes } from "react";

export default function FormField({
  label,
  ...props
}: { label: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="grid gap-1">
      <span className="text-sm text-gray-200">{label}</span>
      <input
        {...props}
        className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white placeholder-white/40 outline-none focus:ring-2 focus:ring-emerald-500"
      />
    </label>
  );
}
