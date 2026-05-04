"use client";

import { useState, useRef } from "react";
import {
  Category, Priority, RecurringType,
  CATEGORY_COLOR, CATEGORY_LABEL, PRIORITY_LABEL,
  CATEGORY_SUGGESTIONS, RECURRING_LABEL,
} from "@/lib/types";
import { slotToTime, timeToSlot, parseDateInput, formatDateLabel, buildDeadlineISO } from "@/lib/deadline";

const CATEGORIES: Category[] = ["work", "home", "training", "english", "hobby", "other"];
const PRIORITIES: Priority[] = ["high", "medium", "low"];
const RECURRING_TYPES: RecurringType[] = ["daily", "weekly", "monthly"];
const WEEK_DAYS = ["日", "月", "火", "水", "木", "金", "土"];

interface AddParams {
  title: string;
  category: Category;
  priority: Priority;
  deadline?: string;
  note?: string;
  recurring?: {
    type: RecurringType;
    weekDays?: number[];
    monthDay?: number;
    deadlineTimeSlot?: number;
  };
}

interface Props {
  onAdd: (params: AddParams) => void;
  onClose: () => void;
}

export default function AddTodoModal({ onAdd, onClose }: Props) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<Category>("work");
  const [priority, setPriority] = useState<Priority>("medium");
  const [note, setNote] = useState("");

  const [deadlineDate, setDeadlineDate] = useState<Date>(new Date());
  const [timeSlot, setTimeSlot] = useState(47);
  const [dateInput, setDateInput] = useState("");
  const [dateEditing, setDateEditing] = useState(false);
  const [manualTime, setManualTime] = useState("");

  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringType, setRecurringType] = useState<RecurringType>("daily");
  const [weekDays, setWeekDays] = useState<number[]>([1, 2, 3, 4, 5]); // 月〜金
  const [monthDay, setMonthDay] = useState(new Date().getDate());

  const dateRef = useRef<HTMLInputElement>(null);

  function commitDateInput() {
    if (!dateInput.trim()) { setDateEditing(false); return; }
    const parsed = parseDateInput(dateInput);
    if (parsed) setDeadlineDate(parsed);
    setDateInput("");
    setDateEditing(false);
  }

  function handleManualTime(val: string) {
    setManualTime(val);
    const match = val.match(/^(\d{1,2}):(\d{2})$/);
    if (match) {
      const slot = timeToSlot(val);
      if (slot >= 0 && slot <= 48) setTimeSlot(slot);
    }
  }

  function toggleWeekDay(d: number) {
    setWeekDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    const deadline = isRecurring ? undefined : buildDeadlineISO(deadlineDate, timeSlot);
    onAdd({
      title: title.trim(),
      category,
      priority,
      deadline,
      note,
      recurring: isRecurring ? {
        type: recurringType,
        weekDays: recurringType === "weekly" ? weekDays : undefined,
        monthDay: recurringType === "monthly" ? monthDay : undefined,
        deadlineTimeSlot: timeSlot,
      } : undefined,
    });
    onClose();
  }

  const priorityStyles: Record<Priority, string> = {
    high: "border-red-400 bg-red-50 text-red-500",
    medium: "border-amber-400 bg-amber-50 text-amber-500",
    low: "border-gray-300 bg-gray-50 text-gray-400",
  };

  const suggestions = CATEGORY_SUGGESTIONS[category];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl p-6 shadow-xl max-h-[92vh] overflow-y-auto">
        <h2 className="text-lg font-semibold mb-5">タスク追加</h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">

          {/* カテゴリ */}
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1.5">カテゴリ</label>
            <div className="grid grid-cols-3 gap-1.5">
              {CATEGORIES.map((c) => {
                const col = CATEGORY_COLOR[c];
                const active = category === c;
                return (
                  <button key={c} type="button" onClick={() => setCategory(c)}
                    className={`py-2 rounded-xl border-2 text-xs font-semibold transition-colors ${active ? `${col.bg} ${col.text} ${col.border}` : "border-gray-200 text-gray-400"}`}>
                    {CATEGORY_LABEL[c]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* タイトル + サジェスト */}
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1.5">タイトル</label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="タスクを入力"
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setTitle(s)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    title === s
                      ? `${CATEGORY_COLOR[category].bg} ${CATEGORY_COLOR[category].text} ${CATEGORY_COLOR[category].border}`
                      : "border-gray-200 text-gray-400 hover:border-gray-300"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* 優先度 */}
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1.5">優先度</label>
            <div className="flex gap-2">
              {PRIORITIES.map((p) => (
                <button key={p} type="button" onClick={() => setPriority(p)}
                  className={`flex-1 py-2 rounded-xl border-2 text-sm font-semibold transition-colors ${priority === p ? priorityStyles[p] : "border-gray-200 text-gray-400"}`}>
                  {PRIORITY_LABEL[p]}
                </button>
              ))}
            </div>
          </div>

          {/* 定期タスク */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">繰り返し</label>
              <button
                type="button"
                onClick={() => setIsRecurring(!isRecurring)}
                className={`w-10 h-5 rounded-full transition-colors relative ${isRecurring ? "bg-indigo-500" : "bg-gray-200"}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${isRecurring ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
            </div>

            {isRecurring && (
              <div className="border border-gray-200 rounded-xl p-3 bg-gray-50 space-y-3">
                <div className="flex gap-1.5">
                  {RECURRING_TYPES.map((r) => (
                    <button key={r} type="button" onClick={() => setRecurringType(r)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border-2 transition-colors ${recurringType === r ? "border-indigo-400 bg-indigo-50 text-indigo-600" : "border-gray-200 text-gray-400"}`}>
                      {RECURRING_LABEL[r]}
                    </button>
                  ))}
                </div>

                {recurringType === "weekly" && (
                  <div className="flex gap-1">
                    {WEEK_DAYS.map((d, i) => (
                      <button key={i} type="button" onClick={() => toggleWeekDay(i)}
                        className={`flex-1 py-1 rounded-lg text-xs font-semibold border transition-colors ${weekDays.includes(i) ? "border-indigo-400 bg-indigo-50 text-indigo-600" : "border-gray-200 text-gray-400"}`}>
                        {d}
                      </button>
                    ))}
                  </div>
                )}

                {recurringType === "monthly" && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">毎月</span>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      value={monthDay}
                      onChange={(e) => setMonthDay(parseInt(e.target.value))}
                      className="w-16 text-sm border border-gray-200 rounded-lg px-2 py-1 text-center focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                    <span className="text-xs text-gray-400">日</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* デッドライン（繰り返し時は時刻のみ） */}
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-2">
              {isRecurring ? "デッドライン（時刻）" : "デッドライン"}
            </label>
            <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 space-y-3">
              {!isRecurring && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-8">日付</span>
                  {dateEditing ? (
                    <input
                      ref={dateRef}
                      autoFocus
                      value={dateInput}
                      onChange={(e) => setDateInput(e.target.value)}
                      onBlur={commitDateInput}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commitDateInput(); } }}
                      placeholder="0504 / 2dl / 1wl"
                      className="flex-1 text-sm border border-indigo-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                  ) : (
                    <button type="button" onClick={() => setDateEditing(true)}
                      className="text-sm font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-1.5 hover:bg-indigo-100 transition-colors">
                      {formatDateLabel(deadlineDate)}
                    </button>
                  )}
                  <span className="text-xs text-gray-300">例: 0504 / 2dl / 1wl</span>
                </div>
              )}

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">時間</span>
                  <span className="text-base font-bold text-indigo-600 tabular-nums">{slotToTime(timeSlot)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-300">0:00</span>
                  <input type="range" min={0} max={48} value={timeSlot}
                    onChange={(e) => { const s = parseInt(e.target.value); setTimeSlot(s); setManualTime(slotToTime(s)); }}
                    className="flex-1 accent-indigo-500" />
                  <span className="text-xs text-gray-300">24:00</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">手入力</span>
                  <input type="text" value={manualTime} onChange={(e) => handleManualTime(e.target.value)}
                    placeholder="14:30"
                    className="w-20 text-sm border border-gray-200 rounded-lg px-2 py-1 text-center focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                </div>
              </div>
            </div>
          </div>

          {/* メモ */}
          <div>
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide block mb-1.5">メモ（任意）</label>
            <textarea value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="詳細やメモを入力" rows={2}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
          </div>

          <button type="submit" disabled={!title.trim()}
            className="w-full bg-indigo-500 text-white rounded-xl py-3.5 font-semibold text-sm disabled:opacity-40 transition-opacity">
            {isRecurring ? "定期タスクとして追加" : "追加する"}
          </button>
        </form>
      </div>
    </div>
  );
}
