"use client";
import { useState, useEffect } from "react";

interface Todo {
  id: string;
  title: string;
  completed: boolean;
  dueDate?: string;
  createdAt: string;
}

export default function TodosPage() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTodo, setNewTodo] = useState("");
  const [dueDate, setDueDate] = useState("");

  useEffect(() => {
    fetchTodos();
  }, []);

  const fetchTodos = async () => {
    try {
      const res = await fetch("/api/todos");
      if (res.ok) {
        const data = await res.json();
        setTodos(data);
      }
    } catch (error) {
      console.error("Failed to fetch todos:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodo.trim()) return;

    try {
      const res = await fetch("/api/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTodo,
          dueDate: dueDate || null,
        }),
      });
      if (res.ok) {
        setNewTodo("");
        setDueDate("");
        fetchTodos();
      }
    } catch (error) {
      console.error("Failed to add todo:", error);
    }
  };

  const toggleComplete = async (id: string, completed: boolean) => {
    try {
      const res = await fetch(`/api/todos/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: !completed }),
      });
      if (res.ok) {
        fetchTodos();
      }
    } catch (error) {
      console.error("Failed to update todo:", error);
    }
  };

  const deleteTodo = async (id: string) => {
    try {
      const res = await fetch(`/api/todos/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchTodos();
      }
    } catch (error) {
      console.error("Failed to delete todo:", error);
    }
  };

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-6">My Todos</h1>

      <form
        onSubmit={handleAddTodo}
        className="mb-6 bg-surface-2 p-4 rounded-lg border border-white/10"
      >
        <div className="flex gap-4">
          <input
            type="text"
            value={newTodo}
            onChange={(e) => setNewTodo(e.target.value)}
            placeholder="Add a new todo..."
            className="flex-1 px-3 py-2 bg-surface-1 border border-white/10 rounded-lg text-white"
          />
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="px-3 py-2 bg-surface-1 border border-white/10 rounded-lg text-white"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent/80"
          >
            Add
          </button>
        </div>
      </form>

      <div className="space-y-2">
        {todos.length === 0 ? (
          <p className="text-white/60">No todos yet. Add one above!</p>
        ) : (
          todos.map((todo) => (
            <div
              key={todo.id}
              className="flex items-center gap-4 bg-surface-2 p-4 rounded-lg border border-white/10"
            >
              <input
                type="checkbox"
                checked={todo.completed}
                onChange={() => toggleComplete(todo.id, todo.completed)}
                className="w-5 h-5"
              />
              <div className="flex-1">
                <span
                  className={`text-white ${todo.completed ? "line-through text-white/50" : ""}`}
                >
                  {todo.title}
                </span>
                {todo.dueDate && (
                  <div className="text-sm text-white/60 mt-1">
                    Due: {new Date(todo.dueDate).toLocaleDateString()}
                  </div>
                )}
              </div>
              <button
                onClick={() => deleteTodo(todo.id)}
                className="px-3 py-1 text-rose hover:bg-rose/10 rounded"
              >
                Delete
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
