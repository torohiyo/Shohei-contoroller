"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export default function SchedulePage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [slots, setSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetched, setFetched] = useState(false);
  const [copied, setCopied] = useState(false);

  async function fetchSlots() {
    setLoading(true);
    setError(null);
    setSlots([]);
    setFetched(false);
    try {
      const res = await fetch("/api/calendar/availability");
      const data = await res.json();
      if (data.error) setError(data.error);
      else { setSlots(data.slots ?? []); setFetched(true); }
    } catch { setError("通信エラーが発生しました"); }
    finally { setLoading(false); }
  }

  async function copyAll() {
    await navigator.clipboard.writeText(slots.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!session) return <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">ログインが必要です</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-base font-bold text-gray-900">空き時間</h1>
          </div>
          <button onClick={fetchSlots} disabled={loading}
            className="text-xs text-white bg-indigo-500 hover:bg-indigo-600 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-40 flex items-center gap-1.5">
            {loading ? <><span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />取得中...</> : fetched ? "再取得" : "空き時間を取得"}
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-5 space-y-3">
        {loading && (
          <div className="bg-white rounded-xl shadow-sm px-4 py-8 text-center space-y-2">
            <div className="w-8 h-8 border-4 border-indigo-100 border-t-indigo-500 rounded-full animate-spin mx-auto" />
            <p className="text-sm text-gray-500">カレンダーを確認中...</p>
          </div>
        )}

        {!loading && error && (
          <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-5 text-center space-y-1">
            <p className="text-sm font-semibold text-red-500">エラーが発生しました</p>
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}

        {!loading && fetched && slots.length === 0 && !error && (
          <div className="flex items-center justify-center py-8 text-gray-400 text-sm">今後10日間に空き時間がありません</div>
        )}

        {!loading && !fetched && !error && (
          <div className="flex items-center justify-center py-16 text-gray-400 text-sm">「空き時間を取得」を押すと今後の空き枠を表示します</div>
        )}

        {!loading && slots.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 flex items-center justify-between border-b border-gray-50">
              <span className="text-sm font-semibold text-gray-800">空き時間（平日 9:00〜19:00）</span>
              <button onClick={copyAll}
                className="text-xs text-indigo-500 hover:text-indigo-700 transition-colors font-medium">
                {copied ? "コピー済み ✓" : "全てコピー"}
              </button>
            </div>
            <div className="divide-y divide-gray-50">
              {slots.map((slot, i) => {
                const [datePart, ...timeParts] = slot.split(" ");
                const dayMatch = slot.match(/\((.)\)/);
                const dayName = dayMatch?.[1] ?? "";
                const isToday = i === 0;
                return (
                  <div key={i} className="px-4 py-3 flex items-start gap-3">
                    <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${isToday ? "bg-indigo-500" : "bg-gray-300"}`} />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-gray-800">{slot.split(") ")[0]})</span>
                      <p className="text-xs text-gray-500 mt-0.5 font-mono">{slot.split(") ")[1]}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
