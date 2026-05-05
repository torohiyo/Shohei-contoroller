"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession, signIn, signOut } from "next-auth/react";
import { useTodos } from "@/lib/useTodos";
import { useCalendar } from "@/lib/useCalendar";
import { useRecurringTasks } from "@/lib/useRecurringTasks";
import { Category, Priority } from "@/lib/types";
import TodoItem from "@/components/TodoItem";
import AddTodoModal from "@/components/AddTodoModal";
import ShoppingList from "@/components/ShoppingList";
import { buildDeadlineISO } from "@/lib/deadline";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
}

function todayLabel() {
  return new Date().toLocaleDateString("ja-JP", { month: "long", day: "numeric", weekday: "short" });
}

export default function Home() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { todos, addTodo, toggleTodo, deleteTodo, syncFromCalendar, completionRate, overdueCount } = useTodos();
  const { events, taskEvents, loading: calLoading } = useCalendar();
  const { addRecurring, getTodayPending, markGenerated } = useRecurringTasks();
  const [showModal, setShowModal] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  // 定期タスクの自動追加
  useEffect(() => {
    const pending = getTodayPending();
    if (pending.length === 0) return;
    pending.forEach((rt) => {
      const deadline = rt.deadlineTimeSlot !== undefined
        ? buildDeadlineISO(new Date(), rt.deadlineTimeSlot)
        : undefined;
      addTodo({ title: rt.title, category: rt.category, priority: rt.priority, deadline, note: rt.note });
    });
    markGenerated(pending.map((t) => t.id));
  }, [getTodayPending, markGenerated, addTodo]);

  useEffect(() => {
    if (calLoading || taskEvents.length === 0) return;
    syncFromCalendar(
      taskEvents.map((e) => ({ id: e.id, title: e.cleanTitle, deadline: e.end }))
    );
  }, [calLoading, taskEvents, syncFromCalendar]);

  useEffect(() => {
    if (overdueCount === 0) return;
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") {
      new Notification("期限切れのタスクがあります", {
        body: `${overdueCount}件のタスクが期限を過ぎています`,
      });
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission();
    }
  }, [overdueCount]);

  const pending = todos.filter((t) => t.status === "pending");
  const completed = todos.filter((t) => t.status === "completed");
  const healthPct = Math.round(completionRate * 100);
  const healthColor = healthPct >= 70 ? "bg-emerald-400" : healthPct >= 40 ? "bg-amber-400" : "bg-red-400";

  if (status === "loading") {
    return <div className="min-h-screen flex items-center justify-center text-gray-400">読み込み中...</div>;
  }

  if (!session) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Shohei Controller</h1>
          <p className="text-gray-400 text-sm">Googleでログインして今日のタスクを管理する</p>
        </div>
        <button
          onClick={() => signIn("google")}
          className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-6 py-3.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Googleでログイン
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-base font-bold text-gray-900">Shohei Controller</h1>
            <p className="text-xs text-gray-400">{todayLabel()}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs text-gray-400">体力</p>
              <div className="flex items-center gap-1.5">
                <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${healthColor}`}
                    style={{ width: `${healthPct}%` }}
                  />
                </div>
                <span className="text-xs font-bold text-gray-500">{healthPct}%</span>
              </div>
            </div>
            <button onClick={() => router.push("/mail")} className="text-xs text-gray-500 hover:text-indigo-600 border border-gray-200 hover:border-indigo-300 rounded-lg px-2.5 py-1.5 transition-colors">
              メール
            </button>
            <button onClick={() => router.push("/schedule")} className="text-xs text-gray-500 hover:text-indigo-600 border border-gray-200 hover:border-indigo-300 rounded-lg px-2.5 py-1.5 transition-colors">
              空き時間
            </button>
            <button onClick={() => router.push("/manage")} className="text-xs text-gray-500 hover:text-indigo-600 border border-gray-200 hover:border-indigo-300 rounded-lg px-2.5 py-1.5 transition-colors">
              サジェスト管理
            </button>
            <button onClick={() => signOut()} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
              ログアウト
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-5">
        <div className="flex gap-5 items-start">

          {/* 左: カレンダー + タスク */}
          <div className="flex-1 min-w-0 space-y-5">
            <section>
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">今日の予定</h2>
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                {calLoading ? (
                  <p className="text-sm text-gray-400 px-4 py-3">読み込み中...</p>
                ) : events.length === 0 ? (
                  <p className="text-sm text-gray-400 px-4 py-3">今日の予定はありません</p>
                ) : (
                  events.map((ev, i) => (
                    <div key={ev.id} className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? "border-t border-gray-50" : ""}`}>
                      <div className="w-1 h-8 bg-indigo-400 rounded-full shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{ev.title}</p>
                        <p className="text-xs text-gray-400">
                          {ev.isAllDay ? "終日" : `${formatTime(ev.start)} – ${formatTime(ev.end)}`}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  今日のタスク{overdueCount > 0 && <span className="ml-1.5 text-red-500">{overdueCount}件期限切れ</span>}
                </h2>
                <button
                  onClick={() => setShowModal(true)}
                  className="w-7 h-7 bg-indigo-500 rounded-full flex items-center justify-center shadow-md shadow-indigo-200"
                >
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>

              <div className="space-y-2">
                {pending.map((todo) => (
                  <TodoItem key={todo.id} todo={todo} onToggle={toggleTodo} onDelete={deleteTodo} />
                ))}
                {completed.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <p className="text-xs text-gray-400 px-1">完了 {completed.length}件</p>
                    {completed.map((todo) => (
                      <TodoItem key={todo.id} todo={todo} onToggle={toggleTodo} onDelete={deleteTodo} />
                    ))}
                  </div>
                )}
                {todos.length === 0 && (
                  <div className="flex items-center justify-center py-12 text-gray-400">
                    <p className="text-sm">タスクを追加してください</p>
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* 右: 買い物リスト */}
          <div className="w-56 shrink-0">
            <ShoppingList />
          </div>
        </div>
      </main>

      {showModal && (
        <AddTodoModal
          onAdd={(p) => {
            if (p.recurring) {
              addRecurring({
                title: p.title,
                category: p.category as Category,
                priority: p.priority as Priority,
                recurring: p.recurring.type,
                weekDays: p.recurring.weekDays,
                monthDay: p.recurring.monthDay,
                deadlineTimeSlot: p.recurring.deadlineTimeSlot,
                note: p.note,
              });
            }
            // 定期タスクでも今日分はすぐ追加
            addTodo({
              title: p.title,
              category: p.category as Category,
              priority: p.priority as Priority,
              deadline: p.deadline ?? (p.recurring?.deadlineTimeSlot !== undefined ? buildDeadlineISO(new Date(), p.recurring.deadlineTimeSlot) : undefined),
              note: p.note,
            });
          }}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
