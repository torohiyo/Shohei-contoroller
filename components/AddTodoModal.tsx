"use client";

import { useState } from "react";
import { Category, Priority, CATEGORY_COLOR, CATEGORY_LABEL, PRIORITY_LABEL } from "@/lib/types";

const CATEGORIES: Category[] = ["work", "home", "other"];
const PRIORITIES: Priority[] = ["high", "medium", "low"];

interface Props {
  onAdd: (params: { title: string; category: Category; priority: Priority; deadline?: string; note?: string }) => void;
  onClose: () => void;
}

export default function AddTodoModal({ onAdd, onClose }: Props) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<Category>("work");
  const [priority, setPriority] = useState<Priority>("medium");
  const [deadline, setDeadline] = useState("");
  const [note, setNote] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onAdd({ title: title.trim(), category, priority, deadline: deadline || undefined, note });
    onClose();
  }

  const priorityStyles: Record<Priority, string> = {
    high: "border-red-400 bg-red-50 text-red-500",
    medium: "border-amber-400 bg-amber-50 text-amber-500",
    low: "border-gray-300 bg-gray-50 text-gray-400",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl p-6 shadow-xl">
        <h2 className="text-lg font-semibold mb-5">タスク追加</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1.5">タイトル</label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="タスクを入力"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1.5">カテゴリ</label>
              <div className="flex gap-1.5">
                {CATEGORIES.map((c) => {
                  const col = CATEGORY_COLOR[c];
                  const active = category === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCategory(c)}
                      className={`flex-1 py-2 rounded-xl border-2 text-xs font-semibold transition-colors ${
                        active ? `${col.bg} ${col.text} ${col.border}` : "border-gray-200 text-gray-400"
                      }`}
                    >
                      {CATEGORY_LABEL[c]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1.5">優先度</label>
              <div className="flex gap-1.5">
                {PRIORITIES.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={`px-3 py-2 rounded-xl border-2 text-xs font-semibold transition-colors ${
                      priority === p ? priorityStyles[p] : "border-gray-200 text-gray-400"
                    }`}
                  >
                    {PRIORITY_LABEL[p]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1.5">
              デッドライン（分単位）
            </label>
            <input
              type="datetime-local"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1.5">メモ（任意）</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="詳細やメモを入力"
              rows={2}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={!title.trim()}
            className="w-full bg-indigo-500 text-white rounded-xl py-3.5 font-semibold text-sm mt-1 disabled:opacity-40 transition-opacity"
          >
            追加する
          </button>
        </form>
      </div>
    </div>
  );
}
