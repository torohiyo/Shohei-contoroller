"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Email {
  id: string;
  threadId?: string;
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

interface ComposeState {
  to: string;
  subject: string;
  notes: string;
  formality: number;
  generatedSubject: string;
  generatedBody: string;
  step: "input" | "generating" | "preview" | "sending" | "sent";
  error: string | null;
}

// ─── Constants ───────────────────────────────────────────────────────────────

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

const FORMALITY_LABELS: Record<number, string> = {
  1: "超カジュアル", 2: "カジュアル", 3: "フレンドリー", 4: "やや丁寧",
  5: "標準", 6: "丁寧", 7: "フォーマル", 8: "かなりフォーマル",
  9: "非常に丁寧", 10: "最大敬語",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function FormalityRow({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-gray-400 shrink-0">トーン</span>
      <input type="range" min={1} max={10} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 h-1 accent-indigo-500" />
      <span className="text-[10px] text-indigo-500 w-24 shrink-0 text-right">
        {value}/10 {FORMALITY_LABELS[value]}
      </span>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function MailPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [tab, setTab] = useState<"check" | "compose">("check");

  // Check tab state
  const [emails, setEmails] = useState<Email[]>([]);
  const [debug, setDebug] = useState<any>(null);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<string | null>(null);
  const [qaMap, setQaMap] = useState<Record<string, QAState>>({});
  const [sendingReply, setSendingReply] = useState<string | null>(null);
  const [sentReply, setSentReply] = useState<Set<string>>(new Set());

  // Compose tab state
  const [compose, setCompose] = useState<ComposeState>({
    to: "", subject: "", notes: "", formality: 5,
    generatedSubject: "", generatedBody: "",
    step: "input", error: null,
  });

  // ── Check tab handlers ────────────────────────────────────────────────────

  async function runAgent() {
    setLoading(true);
    setCheckError(null);
    setEmails([]);
    setChecked(false);
    setQaMap({});
    setDebug(null);
    try {
      const res = await fetch("/api/gmail/agent", { method: "POST" });
      const data = await res.json();
      setDebug(data._debug ?? null);
      if (data.error) setCheckError(data.error);
      else { setEmails(data.important_emails ?? []); setChecked(true); }
    } catch { setCheckError("通信エラーが発生しました"); }
    finally { setLoading(false); }
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function startReply(email: Email, formality: number) {
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
      await generateReply(email, [], slots, formality);
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

  async function submitAnswers(email: Email, formality: number) {
    const qa = qaMap[email.id];
    if (!qa) return;
    setQaMap((prev) => ({ ...prev, [email.id]: { ...qa, step: "loading_reply" } }));
    const answers = qa.questions.map((q, i) => ({ question: q, answer: qa.answers[i] }));
    await generateReply(email, answers, qa.slots, formality);
  }

  async function generateReply(email: Email, answers: { question: string; answer: string }[], slots: string[], formality: number) {
    try {
      const res = await fetch("/api/gmail/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: email.subject, from: email.from, snippet: email.snippet, body: email.body ?? "", answers, formality, slots }),
      });
      const text = await res.text();
      let data: any;
      try { data = JSON.parse(text); } catch { data = { error: text.slice(0, 200) }; }
      const reply = data.error ? `エラー: ${data.error}` : (data.reply ?? "");
      setQaMap((prev) => ({ ...prev, [email.id]: { ...(prev[email.id] ?? { questions: [], answers: [], step: "done", slots: [] }), step: "done", reply } }));
    } catch (e: any) {
      setQaMap((prev) => ({ ...prev, [email.id]: { ...(prev[email.id] ?? { questions: [], answers: [], step: "done", slots: [] }), step: "done", reply: `エラー: ${e?.message ?? "通信失敗"}` } }));
    }
  }

  async function sendReply(email: Email, replyBody: string) {
    setSendingReply(email.id);
    try {
      const res = await fetch("/api/gmail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: email.from,
          subject: email.subject.startsWith("Re:") ? email.subject : `Re: ${email.subject}`,
          body: replyBody,
          originalMessageId: email.id,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setSentReply((prev) => new Set(prev).add(email.id));
    } catch (e: any) {
      alert(`送信失敗: ${e.message}`);
    } finally {
      setSendingReply(null);
    }
  }

  async function copyText(id: string, text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  // ── Compose tab handlers ──────────────────────────────────────────────────

  async function generateEmail() {
    if (!compose.to || !compose.notes) return;
    setCompose((p) => ({ ...p, step: "generating", error: null }));
    try {
      const res = await fetch("/api/gmail/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: compose.to, subject: compose.subject, notes: compose.notes, formality: compose.formality }),
      });
      const text = await res.text();
      let data: any;
      try { data = JSON.parse(text); } catch { data = { error: text.slice(0, 200) }; }
      if (data.error) throw new Error(data.error);
      setCompose((p) => ({ ...p, step: "preview", generatedSubject: data.subject ?? "", generatedBody: data.body ?? "" }));
    } catch (e: any) {
      setCompose((p) => ({ ...p, step: "input", error: e.message }));
    }
  }

  async function sendEmail() {
    setCompose((p) => ({ ...p, step: "sending", error: null }));
    try {
      const res = await fetch("/api/gmail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: compose.to, subject: compose.generatedSubject, body: compose.generatedBody }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setCompose((p) => ({ ...p, step: "sent" }));
    } catch (e: any) {
      setCompose((p) => ({ ...p, step: "preview", error: e.message }));
    }
  }

  function resetCompose() {
    setCompose({ to: "", subject: "", notes: "", formality: 5, generatedSubject: "", generatedBody: "", step: "input", error: null });
  }

  if (!session) return <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">ログインが必要です</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="text-gray-400 hover:text-gray-600 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
              <button onClick={() => setTab("check")}
                className={`text-xs px-3 py-1 rounded-md transition-colors ${tab === "check" ? "bg-white text-gray-900 font-semibold shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                チェック
              </button>
              <button onClick={() => setTab("compose")}
                className={`text-xs px-3 py-1 rounded-md transition-colors ${tab === "compose" ? "bg-white text-gray-900 font-semibold shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
                作成
              </button>
            </div>
            {tab === "check" && checked && !loading && (
              <span className="text-xs text-gray-400">{emails.length}件の重要メール</span>
            )}
          </div>
          {tab === "check" && (
            <button onClick={runAgent} disabled={loading}
              className="text-xs text-white bg-indigo-500 hover:bg-indigo-600 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-40 flex items-center gap-1.5">
              {loading
                ? <><span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />分析中...</>
                : checked ? "再チェック" : "メールをチェック"}
            </button>
          )}
        </div>
      </header>

      {/* ── Check Tab ─────────────────────────────────────────────────────── */}
      {tab === "check" && (
        <main className="max-w-3xl mx-auto px-4 py-5 space-y-3">
          {loading && (
            <div className="bg-white rounded-xl shadow-sm px-4 py-8 text-center space-y-2">
              <div className="w-8 h-8 border-4 border-indigo-100 border-t-indigo-500 rounded-full animate-spin mx-auto" />
              <p className="text-sm text-gray-500">直近48時間のメールを分析中...</p>
            </div>
          )}
          {!loading && checkError && (
            <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-5 text-center space-y-1">
              <p className="text-sm font-semibold text-red-500">エラーが発生しました</p>
              <p className="text-xs text-red-400">{checkError}</p>
            </div>
          )}
          {!loading && checked && emails.length === 0 && !checkError && (
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
          {!loading && !checked && !checkError && (
            <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
              「メールをチェック」を押すと直近48時間のメールを分析します
            </div>
          )}

          {!loading && emails.map((email) => {
            const isExpanded = expanded.has(email.id);
            const qa = qaMap[email.id];
            const isSent = sentReply.has(email.id);

            return (
              <div key={email.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
                {/* Email header */}
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

                {/* Expanded area */}
                {isExpanded && (
                  <div className="border-t border-gray-50 px-4 py-3 space-y-3">
                    {qa?.step === "loading_q" && (
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <span className="w-3 h-3 border-2 border-gray-200 border-t-indigo-400 rounded-full animate-spin" />
                        返信情報を準備中...
                      </div>
                    )}

                    {qa?.step === "answering" && (
                      <AnsweringBlock
                        qa={qa}
                        emailId={email.id}
                        setAnswer={setAnswer}
                        onSubmit={(f) => submitAnswers(email, f)}
                      />
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
                          <div className="flex gap-2 items-center">
                            {isSent ? (
                              <span className="text-xs text-emerald-500 font-medium">送信済み ✓</span>
                            ) : (
                              <button
                                onClick={() => sendReply(email, qa.reply)}
                                disabled={sendingReply === email.id || qa.reply.startsWith("エラー:")}
                                className="text-xs text-white bg-indigo-500 hover:bg-indigo-600 rounded-md px-2.5 py-1 transition-colors disabled:opacity-40 flex items-center gap-1">
                                {sendingReply === email.id
                                  ? <><span className="w-2.5 h-2.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />送信中</>
                                  : "送信"}
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setQaMap((p) => { const n = { ...p }; delete n[email.id]; return n; });
                                setSentReply((p) => { const n = new Set(p); n.delete(email.id); return n; });
                              }}
                              className="text-xs text-gray-400 hover:text-gray-600 transition-colors">再生成</button>
                            <button onClick={() => copyText(email.id, qa.reply)}
                              className="text-xs text-indigo-500 hover:text-indigo-700 transition-colors">
                              {copied === email.id ? "コピー済み ✓" : "コピー"}
                            </button>
                          </div>
                        </div>
                        <textarea
                          value={qa.reply}
                          onChange={(e) => setQaMap((prev) => ({ ...prev, [email.id]: { ...prev[email.id], reply: e.target.value } }))}
                          rows={8}
                          className="w-full text-xs text-gray-700 leading-relaxed bg-transparent border-0 outline-none resize-none"
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                {!qa ? (
                  <EmailActions
                    email={email}
                    isExpanded={isExpanded}
                    onToggleExpand={() => toggleExpand(email.id)}
                    onStartReply={startReply}
                  />
                ) : (
                  <div className="px-4 pb-3">
                    <button onClick={() => toggleExpand(email.id)}
                      className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg px-2.5 py-1.5 transition-colors">
                      {isExpanded ? "閉じる" : "本文を見る"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </main>
      )}

      {/* ── Compose Tab ───────────────────────────────────────────────────── */}
      {tab === "compose" && (
        <main className="max-w-3xl mx-auto px-4 py-5">
          {compose.step === "sent" ? (
            <div className="bg-white rounded-xl shadow-sm px-4 py-12 text-center space-y-4">
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-gray-800">送信しました</p>
              <p className="text-xs text-gray-400">宛先: {compose.to}</p>
              <button onClick={resetCompose}
                className="text-xs text-indigo-500 hover:text-indigo-700 border border-indigo-200 rounded-lg px-4 py-2 transition-colors">
                新しいメールを作成
              </button>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-4 py-4 space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">宛先</label>
                  <input
                    type="email"
                    value={compose.to}
                    onChange={(e) => setCompose((p) => ({ ...p, to: e.target.value }))}
                    placeholder="example@company.com"
                    disabled={compose.step !== "input"}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:bg-gray-50 disabled:text-gray-400"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">件名（省略可）</label>
                  <input
                    type="text"
                    value={compose.subject}
                    onChange={(e) => setCompose((p) => ({ ...p, subject: e.target.value }))}
                    placeholder="AIが推測します"
                    disabled={compose.step !== "input"}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:bg-gray-50 disabled:text-gray-400"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">内容メモ（ラフでOK）</label>
                  <textarea
                    value={compose.notes}
                    onChange={(e) => setCompose((p) => ({ ...p, notes: e.target.value }))}
                    placeholder={"先日のMTGの件、資料送ってもらえるか確認したい。来週月曜までに欲しい。"}
                    rows={4}
                    disabled={compose.step !== "input"}
                    className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none disabled:bg-gray-50 disabled:text-gray-400"
                  />
                </div>

                <FormalityRow
                  value={compose.formality}
                  onChange={(v) => setCompose((p) => ({ ...p, formality: v }))}
                />

                {compose.error && (
                  <p className="text-xs text-red-400 bg-red-50 rounded-lg px-3 py-2">{compose.error}</p>
                )}

                {compose.step === "input" && (
                  <button
                    onClick={generateEmail}
                    disabled={!compose.to || !compose.notes}
                    className="w-full text-sm text-white bg-indigo-500 hover:bg-indigo-600 rounded-lg py-2.5 transition-colors disabled:opacity-40 font-medium">
                    メール文を生成
                  </button>
                )}

                {compose.step === "generating" && (
                  <div className="flex items-center justify-center gap-2 py-4 text-sm text-gray-400">
                    <span className="w-4 h-4 border-2 border-gray-200 border-t-indigo-400 rounded-full animate-spin" />
                    メールを生成中...
                  </div>
                )}
              </div>

              {(compose.step === "preview" || compose.step === "sending") && (
                <div className="border-t border-gray-100 px-4 py-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-600">生成されたメール</span>
                    <button onClick={() => setCompose((p) => ({ ...p, step: "input" }))}
                      className="text-xs text-gray-400 hover:text-gray-600 transition-colors">修正する</button>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">件名</label>
                    <input
                      type="text"
                      value={compose.generatedSubject}
                      onChange={(e) => setCompose((p) => ({ ...p, generatedSubject: e.target.value }))}
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">本文</label>
                    <textarea
                      value={compose.generatedBody}
                      onChange={(e) => setCompose((p) => ({ ...p, generatedBody: e.target.value }))}
                      rows={12}
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none leading-relaxed"
                    />
                  </div>

                  <button
                    onClick={sendEmail}
                    disabled={compose.step === "sending"}
                    className="w-full text-sm text-white bg-indigo-500 hover:bg-indigo-600 rounded-lg py-2.5 transition-colors disabled:opacity-40 font-medium flex items-center justify-center gap-2">
                    {compose.step === "sending"
                      ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />送信中...</>
                      : "送信"}
                  </button>
                </div>
              )}
            </div>
          )}
        </main>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function EmailActions({
  email, isExpanded, onToggleExpand, onStartReply,
}: {
  email: Email;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onStartReply: (email: Email, formality: number) => void;
}) {
  const [formality, setFormality] = useState(5);
  return (
    <div className="px-4 pb-3 space-y-2">
      <FormalityRow value={formality} onChange={setFormality} />
      <div className="flex gap-2">
        <button onClick={onToggleExpand}
          className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg px-2.5 py-1.5 transition-colors">
          {isExpanded ? "閉じる" : "本文を見る"}
        </button>
        <button onClick={() => onStartReply(email, formality)}
          className="text-xs text-white bg-indigo-500 hover:bg-indigo-600 rounded-lg px-2.5 py-1.5 transition-colors">
          返信案を生成
        </button>
      </div>
    </div>
  );
}

function AnsweringBlock({
  qa, emailId, setAnswer, onSubmit,
}: {
  qa: QAState;
  emailId: string;
  setAnswer: (id: string, i: number, v: string) => void;
  onSubmit: (formality: number) => void;
}) {
  const [formality, setFormality] = useState(5);

  return (
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
            onChange={(e) => setAnswer(emailId, i, e.target.value)}
            rows={2}
            placeholder="回答を入力..."
            className="w-full text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none bg-gray-50"
          />
        </div>
      ))}
      <FormalityRow value={formality} onChange={setFormality} />
      <button
        onClick={() => onSubmit(formality)}
        className="text-xs text-white bg-indigo-500 hover:bg-indigo-600 rounded-lg px-3 py-1.5 transition-colors">
        この内容で返信案を生成
      </button>
    </div>
  );
}
