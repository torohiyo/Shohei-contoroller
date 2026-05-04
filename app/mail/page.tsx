"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

interface Email {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  date: string;
  reason: "reply_to_me" | "contract" | "team" | "personal";
  snippet: string;
  body: string;
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
  } catch {
    return dateStr;
  }
}

export default function MailPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<string | null>(null);
  const [markingRead, setMarkingRead] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  const fetchEmails = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/gmail");
      const data = await res.json();
      setEmails(data.emails ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEmails(); }, [fetchEmails]);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function generateReply(email: Email) {
    setGenerating((prev) => new Set(prev).add(email.id));
    try {
      const res = await fetch("/api/gmail/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: email.subject, from: email.from, body: email.body }),
      });
      const data = await res.json();
      setReplies((prev) => ({ ...prev, [email.id]: data.reply }));
      setExpanded((prev) => new Set(prev).add(email.id));
    } finally {
      setGenerating((prev) => { const next = new Set(prev); next.delete(email.id); return next; });
    }
  }

  async function markRead(ids: string[]) {
    setMarkingRead(true);
    await fetch("/api/gmail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    });
    setReadIds((prev) => new Set([...prev, ...ids]));
    setMarkingRead(false);
  }

  async function copyText(id: string, text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  const unreadEmails = emails.filter((e) => !readIds.has(e.id));

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">
        ログインが必要です
      </div>
    );
  }

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
            {!loading && (
              <span className="text-xs text-gray-400">{unreadEmails.length}件</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchEmails}
              disabled={loading}
              className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg px-2.5 py-1.5 transition-colors disabled:opacity-40"
            >
              更新
            </button>
            {unreadEmails.length > 0 && (
              <button
                onClick={() => markRead(unreadEmails.map((e) => e.id))}
                disabled={markingRead}
                className="text-xs text-white bg-indigo-500 hover:bg-indigo-600 rounded-lg px-2.5 py-1.5 transition-colors disabled:opacity-40"
              >
                {markingRead ? "処理中..." : "全て既読"}
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-5 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400 text-sm">読み込み中...</div>
        ) : emails.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-gray-400 text-sm">重要メールはありません</div>
        ) : (
          emails.map((email) => {
            const isRead = readIds.has(email.id);
            const isExpanded = expanded.has(email.id);
            const hasReply = !!replies[email.id];
            const isGenerating = generating.has(email.id);

            return (
              <div
                key={email.id}
                className={`bg-white rounded-xl shadow-sm overflow-hidden transition-opacity ${isRead ? "opacity-50" : ""}`}
              >
                <div className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${REASON_COLOR[email.reason]}`}>
                        {REASON_LABEL[email.reason]}
                      </span>
                      <span className="text-sm font-semibold text-gray-800 leading-snug">{email.subject}</span>
                    </div>
                    <button
                      onClick={() => markRead([email.id])}
                      disabled={isRead}
                      className="text-[10px] text-gray-300 hover:text-gray-500 transition-colors shrink-0 disabled:opacity-0"
                    >
                      既読
                    </button>
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
                    <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">{email.body || email.snippet}</p>

                    {hasReply && (
                      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-indigo-600">返信案</span>
                          <button
                            onClick={() => copyText(email.id, replies[email.id])}
                            className="text-xs text-indigo-500 hover:text-indigo-700 transition-colors"
                          >
                            {copied === email.id ? "コピー済み ✓" : "コピー"}
                          </button>
                        </div>
                        <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{replies[email.id]}</p>
                      </div>
                    )}
                  </div>
                )}

                <div className="px-4 pb-3 flex gap-2">
                  <button
                    onClick={() => toggleExpand(email.id)}
                    className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg px-2.5 py-1.5 transition-colors"
                  >
                    {isExpanded ? "閉じる" : "本文を見る"}
                  </button>
                  <button
                    onClick={() => generateReply(email)}
                    disabled={isGenerating}
                    className="text-xs text-white bg-indigo-500 hover:bg-indigo-600 rounded-lg px-2.5 py-1.5 transition-colors disabled:opacity-40"
                  >
                    {isGenerating ? "生成中..." : hasReply ? "再生成" : "返信案を生成"}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </main>
    </div>
  );
}
