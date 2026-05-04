"use client";

import { useState } from "react";
import { Category, CATEGORY_COLOR, CATEGORY_LABEL } from "@/lib/types";

const CATEGORIES: Category[] = ["work", "home", "other"];

interface Props {
  onAdd: (title: string, category: Category, note?: string) => void;
  onClose: () => void;
}

export default function AddTodoModal({ onAdd, onClose }: Props) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<Category>("work");
  const [note, setNote] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onAdd(title.trim(), category, note);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-white rounded-t-2xl sm:rounded-2xl p-6 shadow-xl">
        <h2 className="text-lg font-semibold mb-5">タスク追加</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1.5">
              タイトル
            </label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="タスクを入力"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1.5">
              カテゴリ
            </label>
            <div className="flex gap-2">
              {CATEGORIES.map((c) => {
                const col = CATEGORY_COLOR[c];
                const active = category === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory(c)}
                    className={`flex-1 py-2 rounded-xl border-2 text-sm font-semibold transition-colors ${
                      active
                        ? `${col.bg} ${col.text} ${col.border}`
                        : "border-gray-200 text-gray-400"
                    }`}
                  >
                    {CATEGORY_LABEL[c]}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1.5">
              メモ（任意）
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="詳細やメモを入力"
              rows={3}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={!title.trim()}
            className="w-full bg-indigo-500 text-white rounded-xl py-3.5 font-semibold text-sm mt-2 disabled:opacity-40 transition-opacity"
          >
            追加する
          </button>
        </form>
      </div>
    </div>
  );
}
