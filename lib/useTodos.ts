"use client";

import { useState, useEffect, useCallback } from "react";
import { Todo, Category, Priority } from "./types";

const STORAGE_KEY = "shohei-todos-v2";

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function loadFromStorage(): Todo[] {
  if (typeof window === "undefined") return [];
  try {
    const json = localStorage.getItem(`${STORAGE_KEY}-${todayKey()}`);
    return json ? JSON.parse(json) : [];
  } catch {
    return [];
  }
}

function saveToStorage(todos: Todo[]) {
  localStorage.setItem(`${STORAGE_KEY}-${todayKey()}`, JSON.stringify(todos));
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
    (params: { title: string; category: Category; priority: Priority; deadline?: string; note?: string }) => {
      const todo: Todo = {
        id: Date.now().toString(),
        title: params.title,
        category: params.category,
        priority: params.priority,
        status: "pending",
        deadline: params.deadline,
        note: params.note?.trim() || undefined,
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
          t.id === id ? { ...t, status: t.status === "completed" ? "pending" : "completed" } : t
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

  const completionRate = todos.length === 0 ? 1 : todos.filter((t) => t.status === "completed").length / todos.length;
  const overdueCount = todos.filter(
    (t) => t.status === "pending" && t.deadline && new Date(t.deadline) < new Date()
  ).length;

  return { todos, addTodo, toggleTodo, deleteTodo, completionRate, overdueCount };
}
