"use client";

import { useState, useEffect, useCallback } from "react";
import { Todo, Category } from "./types";

const STORAGE_KEY = "shohei-todos";

function loadFromStorage(): Todo[] {
  if (typeof window === "undefined") return [];
  try {
    const json = localStorage.getItem(STORAGE_KEY);
    return json ? JSON.parse(json) : [];
  } catch {
    return [];
  }
}

function saveToStorage(todos: Todo[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
}

export function useTodos() {
  const [todos, setTodos] = useState<Todo[]>([]);

  useEffect(() => {
    setTodos(loadFromStorage());
  }, []);

  const persist = useCallback((updated: Todo[]) => {
    setTodos(updated);
    saveToStorage(updated);
  }, []);

  const addTodo = useCallback(
    (title: string, category: Category, note?: string) => {
      const todo: Todo = {
        id: Date.now().toString(),
        title,
        category,
        status: "pending",
        note: note?.trim() || undefined,
        createdAt: new Date().toISOString(),
      };
      persist([todo, ...todos]);
    },
    [todos, persist]
  );

  const toggleTodo = useCallback(
    (id: string) => {
      persist(
        todos.map((t) =>
          t.id === id
            ? { ...t, status: t.status === "completed" ? "pending" : "completed" }
            : t
        )
      );
    },
    [todos, persist]
  );

  const deleteTodo = useCallback(
    (id: string) => {
      persist(todos.filter((t) => t.id !== id));
    },
    [todos, persist]
  );

  return { todos, addTodo, toggleTodo, deleteTodo };
}
