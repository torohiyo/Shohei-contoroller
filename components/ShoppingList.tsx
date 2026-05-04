"use client";

import { useState } from "react";
import { useShoppingList } from "@/lib/useShoppingList";

export default function ShoppingList() {
  const { items, addItem, toggleItem, deleteItem, clearBought } = useShoppingList();
  const [input, setInput] = useState("");

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    addItem(input.trim());
    setInput("");
  }

  const pending = items.filter((i) => !i.bought);
  const bought = items.filter((i) => i.bought);

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">買い物リスト</h2>
        {bought.length > 0 && (
          <button
            onClick={clearBought}
            className="text-xs text-gray-400 hover:text-red-400 transition-colors"
          >
            購入済みを削除
          </button>
        )}
      </div>

      <form onSubmit={handleAdd} className="flex gap-1.5">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="追加する"
          className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-gray-50 min-w-0"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center disabled:opacity-40 shrink-0"
        >
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </form>

      <div className="space-y-1">
        {pending.map((item) => (
          <div key={item.id} className="flex items-center gap-2 group">
            <button
              onClick={() => toggleItem(item.id)}
              className="shrink-0 w-5 h-5 rounded-full border-2 border-gray-300 flex items-center justify-center hover:border-emerald-400 transition-colors"
            />
            <span className="flex-1 text-sm text-gray-700 min-w-0 truncate">{item.name}</span>
            <button
              onClick={() => deleteItem(item.id)}
              className="shrink-0 text-gray-200 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}

        {bought.length > 0 && (
          <div className="pt-1 space-y-1 border-t border-gray-50">
            {bought.map((item) => (
              <div key={item.id} className="flex items-center gap-2 group">
                <button
                  onClick={() => toggleItem(item.id)}
                  className="shrink-0 w-5 h-5 rounded-full border-2 border-emerald-400 bg-emerald-400 flex items-center justify-center"
                >
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </button>
                <span className="flex-1 text-sm text-gray-300 line-through min-w-0 truncate">{item.name}</span>
              </div>
            ))}
          </div>
        )}

        {items.length === 0 && (
          <p className="text-xs text-gray-300 text-center py-3">リストは空です</p>
        )}
      </div>
    </div>
  );
}
