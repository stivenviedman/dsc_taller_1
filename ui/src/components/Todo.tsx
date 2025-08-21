"use client";
import React, { useState, FC } from "react";
import { Navbar } from "./NavBar";
import { Tareas } from "./Tareas";
import { Categorias } from "./Categorias";

interface AppPageProps {
  handleLogout: () => void;
}

export const Todo: FC<AppPageProps> = ({ handleLogout }) => {
  const [view, setView] = useState<"tareas" | "categorias">("tareas");

  return (
    <div className="flex flex-col h-screen w-full">
      {/* Navbar visible only if logged in */}
      <Navbar
        currentView={view}
        onChangeView={setView}
        onLogout={handleLogout}
      />

      {/* Dummy views */}
      <div className="flex-1 p-8">
        {view === "tareas" && <Tareas />}
        {view === "categorias" && <Categorias />}
      </div>
    </div>
  );
};
