"use client";
import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Categoria {
  id: number;
  name: string;
  description: string;
}

export function Categorias() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [openAdd, setOpenAdd] = useState(false);
  const [openDelete, setOpenDelete] = useState(false);
  const [categoriaToDelete, setCategoriaToDelete] = useState<Categoria | null>(
    null
  );
  const [newCategoria, setNewCategoria] = useState<Categoria>({
    id: 0,
    name: "",
    description: "",
  });

  const token =
    typeof window !== "undefined" ? localStorage.getItem("jwt") : null;

  const loadCategorias = async () => {
    if (!token) return;
    try {
      const res = await fetch("http://127.0.0.1:8080/api/categorias", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error("Error fetching categories");
      const data = await res.json();
      setCategorias(data.data);
    } catch (err) {
      console.error(err);
    }
  };

  // Fetch categories on mount
  useEffect(() => {
    loadCategorias();
  }, [token]);

  const handleAddCategoria = async () => {
    if (!newCategoria.name.trim() || !token) return;

    try {
      const res = await fetch("http://127.0.0.1:8080/api/categorias", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newCategoria.name,
          description: newCategoria.description,
        }),
      });

      if (!res.ok) throw new Error("Error creating category");

      // Instead of appending manually, reload from backend
      await loadCategorias();

      setNewCategoria({ id: 0, name: "", description: "" });
      setOpenAdd(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteCategoria = async () => {
    if (!categoriaToDelete || !token) return;

    try {
      const res = await fetch(
        `http://127.0.0.1:8080/api/categorias/${categoriaToDelete.id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!res.ok) throw new Error("Error deleting category");

      setCategorias((prev) =>
        prev.filter((c) => c.id !== categoriaToDelete.id)
      );
      setCategoriaToDelete(null);
      setOpenDelete(false);
    } catch (err) {
      console.error(err);
    }
  };

  console.log(categorias);

  return (
    <div className="max-w-3xl mx-auto p-8 bg-white rounded-xl shadow-lg space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b">
        <h2 className="text-3xl font-bold tracking-tight text-gray-800">
          Categorías
        </h2>
        <Button
          size="sm"
          className="px-4 py-2"
          onClick={() => setOpenAdd(true)}
        >
          + Nueva Categoría
        </Button>
      </div>

      {/* Categories List */}
      <div className="border rounded-lg divide-y bg-gray-50 overflow-hidden">
        {categorias.map((c) => (
          <div
            key={c.id}
            className="flex items-center justify-between p-4 hover:bg-gray-100 transition-colors"
          >
            <div>
              <p className="font-medium text-lg">{c.name}</p>
              <p className="text-sm text-gray-500">{c.description}</p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                setCategoriaToDelete(c);
                setOpenDelete(true);
              }}
            >
              Eliminar
            </Button>
          </div>
        ))}
        {categorias.length === 0 && (
          <div className="p-6 text-center text-gray-500 text-sm">
            No hay categorías registradas.
          </div>
        )}
      </div>

      {/* Add Modal */}
      <Dialog open={openAdd} onOpenChange={setOpenAdd}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold">
              Crear nueva categoría
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label className="mb-1 block">Nombre</Label>
              <Input
                placeholder="Ej. Electrónica"
                value={newCategoria.name}
                onChange={(e) =>
                  setNewCategoria({ ...newCategoria, name: e.target.value })
                }
              />
            </div>
            <div>
              <Label className="mb-1 block">Descripción</Label>
              <Input
                placeholder="Ej. Productos de tecnología"
                value={newCategoria.description}
                onChange={(e) =>
                  setNewCategoria({
                    ...newCategoria,
                    description: e.target.value,
                  })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpenAdd(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddCategoria}>Agregar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={openDelete} onOpenChange={setOpenDelete}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">
              Eliminar Categoría
            </DialogTitle>
          </DialogHeader>
          <p className="text-center text-gray-600">
            ¿Desea eliminar{" "}
            <span className="font-medium text-gray-900">
              {categoriaToDelete?.name}
            </span>
            ?
          </p>
          <DialogFooter className="flex justify-center gap-4">
            <Button variant="secondary" onClick={() => setOpenDelete(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeleteCategoria}>
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
