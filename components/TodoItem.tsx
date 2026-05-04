"use client";

import { useEffect, useState } from "react";
import { Todo, CATEGORY_COLOR, CATEGORY_LABEL, PRIORITY_COLOR, PRIORITY_LABEL } from "@/lib/types";

interface Props {
  todo: Todo;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

function formatDeadline(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  const mins = Math.floor(diff / 60000);
  if (diff < 0) return { label: `${Math.abs(mins)}分超過`, overdue: true };
  if (mins < 60) return { label: `あと${mins}分`, overdue: false };
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  return { label: `あと${hours}時間${rem > 0 ? rem + "分" : ""}`, overdue: false };
}

export default function TodoItem({ todo, onToggle, onDelete }: Props) {
  const done = todo.status === "completed";
  const col = CATEGORY_COLOR[todo.category];
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!todo.deadline || done) return;
    const id = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, [todo.deadline, done]);

  const deadlineInfo = todo.deadline && !done ? formatDeadline(todo.deadline) : null;

  return (
    <div
      className={`flex items-center gap-3 bg-white rounded-xl px-4 py-3.5 shadow-sm border transition-colors ${
        deadlineInfo?.overdue ? "border-red-200 bg-red-50" : "border-transparent"
      }`}
    >
      <button
        onClick={() => onToggle(todo.id)}
        className="shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors"
        style={{
          borderColor: done ? "#10B981" : "#D1D5DB",
          backgroundColor: done ? "#10B981" : "transparent",
        }}
      >
        {done && (
          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold ${PRIORITY_COLOR[todo.priority]}`}>
            {PRIORITY_LABEL[todo.priority]}
          </span>
          <p className={`text-sm font-medium truncate ${done ? "line-through text-gray-400" : "text-gray-900"}`}>
            {todo.title}
          </p>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {deadlineInfo && (
            <span className={`text-xs font-semibold ${deadlineInfo.overdue ? "text-red-500" : "text-gray-400"}`}>
              {deadlineInfo.label}
            </span>
          )}
          {todo.note && !deadlineInfo && (
            <p className="text-xs text-gray-400 truncate">{todo.note}</p>
          )}
        </div>
      </div>

      <span className={`shrink-0 text-xs font-semibold px-2 py-1 rounded-md ${col.bg} ${col.text}`}>
        {CATEGORY_LABEL[todo.category]}
      </span>

      <button onClick={() => onDelete(todo.id)} className="shrink-0 text-gray-300 hover:text-red-400 transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  );
}
