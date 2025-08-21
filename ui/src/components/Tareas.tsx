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

interface Task {
  id: number;
  description: string;
  finalizationDate: string;
  state: string;
  category_id: number;
  Category?: Categoria;
}

export function Tareas() {
  const [tareas, setTareas] = useState<Task[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [addingTask, setAddingTask] = useState<Task | null>(null);
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);

  const [filterCategory, setFilterCategory] = useState<number | "">("");
  const [filterState, setFilterState] = useState<string>("");

  const token =
    typeof window !== "undefined" ? localStorage.getItem("jwt") : null;

  const loadTasks = async () => {
    if (!token) return;
    try {
      const res = await fetch("http://127.0.0.1:8080/api/user_tasks", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Error loading tasks");
      const data = await res.json();
      setTareas(data.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadCategorias = async () => {
    if (!token) return;
    try {
      const res = await fetch("http://127.0.0.1:8080/api/categorias", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Error loading categories");
      const data = await res.json();
      setCategorias(data.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadTasks();
    loadCategorias();
  }, []);

  useEffect(() => {
    loadTasks();
    loadCategorias();
  }, [token]);

  const handleAddTask = async () => {
    if (!addingTask || !token) return;
    try {
      await fetch("http://127.0.0.1:8080/api/create_tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          description: addingTask.description,
          finalizationDate: new Date(addingTask.finalizationDate).toISOString(),
          state: addingTask.state,
          category_id: addingTask.category_id,
        }),
      });
      setAddingTask(null);
      loadTasks();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingTask || !token) return;
    try {
      await fetch(`http://127.0.0.1:8080/api/update_task/${editingTask.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          description: editingTask.description,
          finalizationDate: new Date(
            editingTask.finalizationDate
          ).toISOString(),
          state: editingTask.state,
          category_id: editingTask.category_id,
        }),
      });
      setEditingTask(null);
      loadTasks();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async () => {
    if (!deletingTask || !token) return;
    try {
      await fetch(`http://127.0.0.1:8080/api/delete_task/${deletingTask.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setDeletingTask(null);
      loadTasks();
    } catch (err) {
      console.error(err);
    }
  };

  // Map task state to color classes
  const stateColor = (state: string) => {
    switch (state) {
      case "pendiente":
        return "bg-yellow-200 text-yellow-800";
      case "activo":
        return "bg-blue-200 text-blue-800";
      case "hecho":
        return "bg-green-200 text-green-800";
      default:
        return "bg-gray-200 text-gray-800";
    }
  };

  // Filter tasks before rendering
  const filteredTareas = tareas.filter((t) => {
    const categoryMatch =
      filterCategory === "" || t.category_id === filterCategory;
    const stateMatch = filterState === "" || t.state === filterState;
    return categoryMatch && stateMatch;
  });

  return (
    <div className="max-w-3xl mx-auto p-8 bg-white rounded-xl shadow-lg space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b">
        <h2 className="text-3xl font-bold tracking-tight text-gray-800">
          Tareas
        </h2>
        <Button
          size="sm"
          onClick={() =>
            setAddingTask({
              id: 0,
              description: "",
              finalizationDate: "",
              state: "pendiente",
              category_id: 0,
            })
          }
        >
          + Nueva Tarea
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 pb-4">
        <div>
          <Label>Filtrar por Categoría</Label>
          <select
            value={filterCategory}
            onChange={(e) =>
              setFilterCategory(e.target.value ? Number(e.target.value) : "")
            }
            className="border p-2 rounded"
          >
            <option value="">Todas</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <Label>Filtrar por Estado</Label>
          <select
            value={filterState}
            onChange={(e) => setFilterState(e.target.value)}
            className="border p-2 rounded"
          >
            <option value="">Todos</option>
            <option value="pendiente">Pendiente</option>
            <option value="activo">Activo</option>
            <option value="hecho">Hecho</option>
          </select>
        </div>
      </div>

      {/* Task list */}
      <div className="border rounded-lg divide-y bg-gray-50 overflow-hidden">
        {filteredTareas.map((t) => (
          <div
            key={t.id}
            className="flex items-center justify-between p-4 hover:bg-gray-100"
          >
            <div>
              <p className="font-medium text-lg">{t.description}</p>
              <p className="text-sm flex items-center gap-2">
                {t.finalizationDate.split("T")[0]}
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${stateColor(
                    t.state
                  )}`}
                >
                  {t.state}
                </span>
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setEditingTask(t)}
              >
                Editar
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setDeletingTask(t)}
              >
                Eliminar
              </Button>
            </div>
          </div>
        ))}
        {filteredTareas.length === 0 && (
          <div className="p-6 text-center text-gray-500 text-sm">
            No hay tareas registradas.
          </div>
        )}
      </div>

      {/* ADD TASK MODAL */}
      <Dialog open={!!addingTask} onOpenChange={() => setAddingTask(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Tarea Nueva</DialogTitle>
          </DialogHeader>
          {addingTask && (
            <div className="space-y-4 pt-2">
              <div>
                <Label>Descripción</Label>
                <Input
                  value={addingTask.description}
                  onChange={(e) =>
                    setAddingTask({
                      ...addingTask,
                      description: e.target.value,
                    })
                  }
                />
              </div>
              <div>
                <Label>Fecha Finalización</Label>
                <Input
                  type="date"
                  value={addingTask.finalizationDate}
                  onChange={(e) =>
                    setAddingTask({
                      ...addingTask,
                      finalizationDate: e.target.value,
                    })
                  }
                />
              </div>
              <div>
                <Label>Categoría</Label>
                <select
                  value={addingTask.category_id}
                  onChange={(e) =>
                    setAddingTask({
                      ...addingTask,
                      category_id: Number(e.target.value),
                    })
                  }
                  className="border p-2 rounded w-full"
                >
                  <option value="">Seleccione...</option>
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Estado</Label>
                <select
                  value={addingTask.state}
                  onChange={(e) =>
                    setAddingTask({
                      ...addingTask,
                      state: e.target.value,
                    })
                  }
                  className="border p-2 rounded w-full"
                >
                  <option value="pendiente">Pendiente</option>
                  <option value="activo">Activo</option>
                  <option value="hecho">Hecho</option>
                </select>
              </div>
              <DialogFooter>
                <Button variant="secondary" onClick={() => setAddingTask(null)}>
                  Cancelar
                </Button>
                <Button onClick={handleAddTask}>Agregar</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* EDIT TASK MODAL */}
      <Dialog open={!!editingTask} onOpenChange={() => setEditingTask(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar</DialogTitle>
          </DialogHeader>
          {editingTask && (
            <div className="space-y-4 pt-2">
              <div>
                <Label>Descripción</Label>
                <Input
                  value={editingTask.description}
                  onChange={(e) =>
                    setEditingTask({
                      ...editingTask,
                      description: e.target.value,
                    })
                  }
                />
              </div>
              <div>
                <Label>Fecha Finalización</Label>
                <Input
                  type="date"
                  value={editingTask.finalizationDate.split("T")[0]}
                  onChange={(e) =>
                    setEditingTask({
                      ...editingTask,
                      finalizationDate: e.target.value,
                    })
                  }
                />
              </div>
              <div>
                <Label>Categoría</Label>
                <select
                  value={editingTask.category_id}
                  onChange={(e) =>
                    setEditingTask({
                      ...editingTask,
                      category_id: Number(e.target.value),
                    })
                  }
                  className="border p-2 rounded w-full"
                >
                  <option value="">Seleccione...</option>
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Estado</Label>
                <select
                  value={editingTask.state}
                  onChange={(e) =>
                    setEditingTask({ ...editingTask, state: e.target.value })
                  }
                  className="border p-2 rounded w-full"
                >
                  <option value="pendiente">Pendiente</option>
                  <option value="activo">Activo</option>
                  <option value="hecho">Hecho</option>
                </select>
              </div>
              <DialogFooter>
                <Button
                  variant="secondary"
                  onClick={() => setEditingTask(null)}
                >
                  Cancelar
                </Button>
                <Button onClick={handleSaveEdit}>Modificar</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* DELETE MODAL */}
      <Dialog open={!!deletingTask} onOpenChange={() => setDeletingTask(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Eliminar</DialogTitle>
          </DialogHeader>
          {deletingTask && (
            <>
              <p className="text-center">
                ¿Desea eliminar{" "}
                <span className="font-medium">{deletingTask.description}</span>?
              </p>
              <DialogFooter className="flex justify-center gap-4">
                <Button
                  variant="secondary"
                  onClick={() => setDeletingTask(null)}
                >
                  Cancelar
                </Button>
                <Button variant="destructive" onClick={handleDelete}>
                  Eliminar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
