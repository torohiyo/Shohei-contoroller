"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Category, CATEGORY_LABEL, CATEGORY_COLOR } from "@/lib/types";
import { useCustomSuggestions } from "@/lib/useCustomSuggestions";

const CATEGORIES: Category[] = ["work", "home", "training", "english", "hobby", "other"];

export default function ManagePage() {
  const router = useRouter();
  const { suggestions, addSuggestion, removeSuggestion, editSuggestion, resetCategory } = useCustomSuggestions();
  const [activeCategory, setActiveCategory] = useState<Category>("work");
  const [newInput, setNewInput] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");

  function handleAdd() {
    if (!newInput.trim()) return;
    addSuggestion(activeCategory, newInput);
    setNewInput("");
  }

  function startEdit(i: number) {
    setEditingIndex(i);
    setEditingText(suggestions[activeCategory][i]);
  }

  function commitEdit() {
    if (editingIndex === null) return;
    editSuggestion(activeCategory, editingIndex, editingText);
    setEditingIndex(null);
    setEditingText("");
  }

  const col = CATEGORY_COLOR[activeCategory];
  const currentSuggestions = suggestions[activeCategory] ?? [];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-base font-bold text-gray-900">サジェスト管理</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5 space-y-5">
        {/* カテゴリ選択 */}
        <div className="grid grid-cols-3 gap-2">
          {CATEGORIES.map((c) => {
            const active = activeCategory === c;
            const cc = CATEGORY_COLOR[c];
            return (
              <button
                key={c}
                onClick={() => { setActiveCategory(c); setEditingIndex(null); setNewInput(""); }}
                className={`py-2.5 rounded-xl border-2 text-sm font-semibold transition-colors ${
                  active ? `${cc.bg} ${cc.text} ${cc.border}` : "border-gray-200 text-gray-400 bg-white"
                }`}
              >
                {CATEGORY_LABEL[c]}
              </button>
            );
          })}
        </div>

        {/* サジェスト一覧 */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
            <h2 className={`text-sm font-semibold ${col.text}`}>
              {CATEGORY_LABEL[activeCategory]}のサジェスト
            </h2>
            <button
              onClick={() => { if (confirm("デフォルトに戻しますか？")) resetCategory(activeCategory); }}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              リセット
            </button>
          </div>

          <div className="divide-y divide-gray-50">
            {currentSuggestions.map((s, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                {editingIndex === i ? (
                  <>
                    <input
                      autoFocus
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") commitEdit(); if (e.key === "Escape") setEditingIndex(null); }}
                      className="flex-1 text-sm border border-indigo-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                    <button onClick={commitEdit} className="text-xs text-indigo-500 font-semibold">保存</button>
                    <button onClick={() => setEditingIndex(null)} className="text-xs text-gray-400">キャンセル</button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-sm text-gray-700">{s}</span>
                    <button onClick={() => startEdit(i)} className="text-gray-300 hover:text-indigo-400 transition-colors">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <button onClick={() => removeSuggestion(activeCategory, i)} className="text-gray-300 hover:text-red-400 transition-colors">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>

          {/* 追加入力 */}
          <div className="flex items-center gap-2 px-4 py-3 border-t border-gray-100">
            <input
              value={newInput}
              onChange={(e) => setNewInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
              placeholder="新しいサジェストを追加"
              className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-gray-50"
            />
            <button
              onClick={handleAdd}
              disabled={!newInput.trim()}
              className={`px-4 py-2 rounded-lg text-sm font-semibold text-white transition-opacity disabled:opacity-40 ${col.border.replace("border-", "bg-")}`}
              style={{ backgroundColor: activeCategory === "work" ? "#5B5FEF" : activeCategory === "home" ? "#10B981" : activeCategory === "training" ? "#F97316" : activeCategory === "english" ? "#3B82F6" : activeCategory === "hobby" ? "#8B5CF6" : "#6B7280" }}
            >
              追加
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
