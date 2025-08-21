"use client";
import React from "react";

export function Navbar({
  currentView,
  onChangeView,
  onLogout,
}: {
  currentView: "tareas" | "categorias";
  onChangeView: (view: "tareas" | "categorias") => void;
  onLogout: () => void;
}) {
  return (
    <nav className="flex flex-row gap-8 bg-gray-800 text-white p-4 justify-around">
      <button
        className={`hover:underline ${
          currentView === "tareas" ? "font-bold underline" : ""
        }`}
        onClick={() => onChangeView("tareas")}
      >
        Tareas
      </button>
      <button
        className={`hover:underline ${
          currentView === "categorias" ? "font-bold underline" : ""
        }`}
        onClick={() => onChangeView("categorias")}
      >
        Categorías
      </button>
      <button
        className="hover:underline text-red-300"
        onClick={onLogout}
      >
        Salir
      </button>
    </nav>
  );
}
