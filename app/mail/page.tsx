"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

interface Email {
  id: string;
  subject: string;
  from: string;
  date: string;
  reason: "reply_to_me" | "contract" | "team" | "personal";
  snippet: string;
  reply_draft: string;
  body?: string;
}

interface QAState {
  questions: string[];
  answers: string[];
  step: "loading_q" | "answering" | "loading_reply" | "done";
  reply: string;
  slots: string[];
}

const REASON_LABEL: Record<Email["reason"], string> = {
  reply_to_me: "自分への返信",
  contract: "契約関連",
  team: "チームから",
  personal: "個人メール",
};

const REASON_COLOR: Record<Email["reason"], string> = {
  reply_to_me: "bg-indigo-50 text-indigo-600 border-indigo-200",
  contract: "bg-red-50 text-red-600 border-red-200",
  team: "bg-emerald-50 text-emerald-600 border-emerald-200",
  personal: "bg-gray-100 text-gray-500 border-gray-200",
};

function formatFrom(from: string) {
  const match = from.match(/^"?([^"<]+)"?\s*</);
  return match ? match[1].trim() : from.replace(/<.*>/, "").trim();
}

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleString("ja-JP", {
      month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
  } catch { return dateStr; }
}

const FORMALITY_LABELS: Record<number, string> = {
  1: "超カジュアル", 2: "カジュアル", 3: "フレンドリー", 4: "やや丁寧",
  5: "標準", 6: "丁寧", 7: "フォーマル", 8: "かなりフォーマル",
  9: "非常に丁寧", 10: "最大敬語",
};

export default function MailPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [emails, setEmails] = useState<Email[]>([]);
  const [debug, setDebug] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<string | null>(null);
  const [qaMap, setQaMap] = useState<Record<string, QAState>>({});
  const [formality, setFormality] = useState(5);

  async function runAgent() {
    setLoading(true);
    setError(null);
    setEmails([]);
    setChecked(false);
    setQaMap({});
    setDebug(null);
    try {
      const res = await fetch("/api/gmail/agent", { method: "POST" });
      const data = await res.json();
      setDebug(data._debug ?? null);
      if (data.error) setError(data.error);
      else { setEmails(data.important_emails ?? []); setChecked(true); }
    } catch { setError("通信エラーが発生しました"); }
    finally { setLoading(false); }
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function startReply(email: Email) {
    setQaMap((prev) => ({ ...prev, [email.id]: { questions: [], answers: [], step: "loading_q", reply: "", slots: [] } }));
    setExpanded((prev) => new Set(prev).add(email.id));

    const [questionsResult, calendarResult] = await Promise.allSettled([
      fetch("/api/gmail/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: email.subject, from: email.from, snippet: email.snippet, body: email.body ?? "" }),
      }).then((r) => r.json()),
      fetch("/api/calendar/availability").then((r) => r.json()),
    ]);

    const questions: string[] = questionsResult.status === "fulfilled" ? (questionsResult.value.questions ?? []) : [];
    const slots: string[] = calendarResult.status === "fulfilled" ? (calendarResult.value.slots ?? []) : [];

    if (questions.length === 0) {
      setQaMap((prev) => ({ ...prev, [email.id]: { questions: [], answers: [], step: "loading_reply", reply: "", slots } }));
      await generateReply(email, [], slots);
    } else {
      setQaMap((prev) => ({ ...prev, [email.id]: { questions, answers: Array(questions.length).fill(""), step: "answering", reply: "", slots } }));
    }
  }

  function setAnswer(emailId: string, index: number, value: string) {
    setQaMap((prev) => {
      const qa = prev[emailId];
      if (!qa) return prev;
      const answers = [...qa.answers];
      answers[index] = value;
      return { ...prev, [emailId]: { ...qa, answers } };
    });
  }

  async function submitAnswers(email: Email) {
    const qa = qaMap[email.id];
    if (!qa) return;
    setQaMap((prev) => ({ ...prev, [email.id]: { ...qa, step: "loading_reply" } }));
    const answers = qa.questions.map((q, i) => ({ question: q, answer: qa.answers[i] }));
    await generateReply(email, answers, qa.slots);
  }

  async function generateReply(email: Email, answers: { question: string; answer: string }[], slots: string[]) {
    try {
      const res = await fetch("/api/gmail/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: email.subject, from: email.from, snippet: email.snippet, body: email.body ?? "", answers, formality, slots }),
      });
      const text = await res.text();
      let data: any;
      try { data = JSON.parse(text); } catch { data = { error: text.slice(0, 200) }; }
      if (data.error) {
        setQaMap((prev) => ({ ...prev, [email.id]: { ...(prev[email.id] ?? { questions: [], answers: [], step: "done", slots: [] }), step: "done", reply: `エラー: ${data.error}` } }));
      } else {
        setQaMap((prev) => ({ ...prev, [email.id]: { ...(prev[email.id] ?? { questions: [], answers: [], step: "done", slots: [] }), step: "done", reply: data.reply ?? "" } }));
      }
    } catch (e: any) {
      setQaMap((prev) => ({ ...prev, [email.id]: { ...(prev[email.id] ?? { questions: [], answers: [], step: "done", slots: [] }), step: "done", reply: `エラー: ${e?.message ?? "通信失敗"}` } }));
    }
  }

  async function copyText(id: string, text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
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
            <h1 className="text-base font-bold text-gray-900">メールチェック</h1>
            {checked && !loading && <span className="text-xs text-gray-400">{emails.length}件の重要メール</span>}
          </div>
          <button onClick={runAgent} disabled={loading}
            className="text-xs text-white bg-indigo-500 hover:bg-indigo-600 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-40 flex items-center gap-1.5">
            {loading ? <><span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />分析中...</> : checked ? "再チェック" : "メールをチェック"}
          </button>
        </div>

      </header>

      <main className="max-w-3xl mx-auto px-4 py-5 space-y-3">
        {loading && (
          <div className="bg-white rounded-xl shadow-sm px-4 py-8 text-center space-y-2">
            <div className="w-8 h-8 border-4 border-indigo-100 border-t-indigo-500 rounded-full animate-spin mx-auto" />
            <p className="text-sm text-gray-500">直近48時間のメールを分析中...</p>
          </div>
        )}
        {!loading && error && (
          <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-5 text-center space-y-1">
            <p className="text-sm font-semibold text-red-500">エラーが発生しました</p>
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}
        {!loading && checked && emails.length === 0 && !error && (
          <div className="space-y-3">
            <div className="flex items-center justify-center py-8 text-gray-400 text-sm">重要メールはありません</div>
            {debug && (
              <details className="bg-gray-100 rounded-xl p-3 text-xs text-gray-500">
                <summary className="cursor-pointer font-semibold">デバッグ情報</summary>
                <pre className="mt-2 whitespace-pre-wrap break-all">{JSON.stringify(debug, null, 2)}</pre>
              </details>
            )}
          </div>
        )}
        {!loading && !checked && !error && (
          <div className="flex items-center justify-center py-16 text-gray-400 text-sm">「メールをチェック」を押すと直近48時間のメールを分析します</div>
        )}

        {!loading && emails.map((email) => {
          const isExpanded = expanded.has(email.id);
          const qa = qaMap[email.id];

          return (
            <div key={email.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-4 py-3">
                <div className="flex items-start gap-2 mb-1">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${REASON_COLOR[email.reason]}`}>
                    {REASON_LABEL[email.reason]}
                  </span>
                  <span className="text-sm font-semibold text-gray-800 leading-snug">{email.subject}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
                  <span>{formatFrom(email.from)}</span>
                  <span>·</span>
                  <span>{formatDate(email.date)}</span>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">{email.snippet}</p>
              </div>

              {isExpanded && (
                <div className="border-t border-gray-50 px-4 py-3 space-y-3">
                  {qa?.step === "loading_q" && (
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <span className="w-3 h-3 border-2 border-gray-200 border-t-indigo-400 rounded-full animate-spin" />
                      返信情報を準備中...
                    </div>
                  )}

                  {qa?.step === "answering" && (
                    <div className="space-y-3">
                      {qa.slots.length > 0 && (
                        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 space-y-1">
                          <p className="text-[10px] font-semibold text-blue-500">空き時間（自動取得）</p>
                          {qa.slots.map((s, i) => (
                            <p key={i} className="text-xs text-blue-700 font-mono">{s}</p>
                          ))}
                        </div>
                      )}
                      <p className="text-xs font-semibold text-gray-500">返信前に確認させてください</p>
                      {qa.questions.map((q, i) => (
                        <div key={i} className="space-y-1">
                          <p className="text-xs text-gray-600">{q}</p>
                          <textarea
                            value={qa.answers[i]}
                            onChange={(e) => setAnswer(email.id, i, e.target.value)}
                            rows={2}
                            placeholder="回答を入力..."
                            className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none bg-gray-50"
                          />
                        </div>
                      ))}
                      <button
                        onClick={() => submitAnswers(email)}
                        className="text-xs text-white bg-indigo-500 hover:bg-indigo-600 rounded-lg px-3 py-1.5 transition-colors"
                      >
                        この内容で返信案を生成
                      </button>
                    </div>
                  )}

                  {qa?.step === "loading_reply" && (
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <span className="w-3 h-3 border-2 border-gray-200 border-t-indigo-400 rounded-full animate-spin" />
                      返信案を生成中...
                    </div>
                  )}

                  {qa?.step === "done" && qa.reply && (
                    <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-indigo-600">返信案</span>
                        <div className="flex gap-2">
                          <button onClick={() => { setQaMap((p) => { const n = { ...p }; delete n[email.id]; return n; }); }}
                            className="text-xs text-gray-400 hover:text-gray-600 transition-colors">再生成</button>
                          <button onClick={() => copyText(email.id, qa.reply)}
                            className="text-xs text-indigo-500 hover:text-indigo-700 transition-colors">
                            {copied === email.id ? "コピー済み ✓" : "コピー"}
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{qa.reply}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="px-4 pb-3 space-y-2">
                {!qa && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-400 shrink-0">トーン</span>
                    <input type="range" min={1} max={10} value={formality} onChange={(e) => setFormality(Number(e.target.value))}
                      className="flex-1 h-1 accent-indigo-500" />
                    <span className="text-[10px] text-indigo-500 w-20 shrink-0 text-right">{formality}/10 {FORMALITY_LABELS[formality]}</span>
                  </div>
                )}
                <div className="flex gap-2">
                  <button onClick={() => toggleExpand(email.id)}
                    className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg px-2.5 py-1.5 transition-colors">
                    {isExpanded ? "閉じる" : "本文を見る"}
                  </button>
                  {!qa && (
                    <button onClick={() => startReply(email)}
                      className="text-xs text-white bg-indigo-500 hover:bg-indigo-600 rounded-lg px-2.5 py-1.5 transition-colors">
                      返信案を生成
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </main>
    </div>
  );
}
