"use client";

import { useState } from "react";
import { useTodos } from "@/lib/useTodos";
import { Category, CATEGORY_LABEL } from "@/lib/types";
import TodoItem from "@/components/TodoItem";
import AddTodoModal from "@/components/AddTodoModal";

type Filter = "all" | Category;

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "すべて" },
  { key: "work", label: "仕事" },
  { key: "home", label: "家事" },
  { key: "other", label: "その他" },
];

export default function Home() {
  const { todos, addTodo, toggleTodo, deleteTodo } = useTodos();
  const [filter, setFilter] = useState<Filter>("all");
  const [showModal, setShowModal] = useState(false);

  const filtered = filter === "all" ? todos : todos.filter((t) => t.category === filter);
  const pending = filtered.filter((t) => t.status === "pending");
  const completed = filtered.filter((t) => t.status === "completed");

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900">Shohei Controller</h1>
          <button
            onClick={() => setShowModal(true)}
            className="w-9 h-9 bg-indigo-500 rounded-full flex items-center justify-center shadow-md shadow-indigo-200"
          >
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        <div className="max-w-lg mx-auto px-4 pb-3 flex gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                filter === f.key
                  ? "bg-indigo-500 text-white"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-5 space-y-6">
        {pending.length > 0 && (
          <section className="space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">
              未完了 {pending.length}件
            </p>
            {pending.map((todo) => (
              <TodoItem key={todo.id} todo={todo} onToggle={toggleTodo} onDelete={deleteTodo} />
            ))}
          </section>
        )}

        {completed.length > 0 && (
          <section className="space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">
              完了 {completed.length}件
            </p>
            {completed.map((todo) => (
              <TodoItem key={todo.id} todo={todo} onToggle={toggleTodo} onDelete={deleteTodo} />
            ))}
          </section>
        )}

        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400">
            <p className="text-sm">タスクはありません</p>
          </div>
        )}
      </main>

      {showModal && (
        <AddTodoModal onAdd={addTodo} onClose={() => setShowModal(false)} />
      )}
    </div>
  );
}
