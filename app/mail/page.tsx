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
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checked, setChecked] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<string | null>(null);

  async function runAgent() {
    setLoading(true);
    setError(null);
    setEmails([]);
    setChecked(false);
    try {
      const res = await fetch("/api/gmail/agent", { method: "POST" });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setEmails(data.important_emails ?? []);
        setChecked(true);
      }
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function copyText(id: string, text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

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
            {checked && !loading && (
              <span className="text-xs text-gray-400">{emails.length}件の重要メール</span>
            )}
          </div>
          <button
            onClick={runAgent}
            disabled={loading}
            className="text-xs text-white bg-indigo-500 hover:bg-indigo-600 rounded-lg px-3 py-1.5 transition-colors disabled:opacity-40 flex items-center gap-1.5"
          >
            {loading ? (
              <>
                <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                AIが処理中...
              </>
            ) : checked ? "再チェック" : "メールをチェック"}
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-5 space-y-3">
        {loading && (
          <div className="bg-white rounded-xl shadow-sm px-4 py-8 text-center space-y-2">
            <div className="w-8 h-8 border-4 border-indigo-100 border-t-indigo-500 rounded-full animate-spin mx-auto" />
            <p className="text-sm text-gray-500">Claudeがメールを読んで分類・返信案を生成中...</p>
            <p className="text-xs text-gray-400">30秒ほどかかります</p>
          </div>
        )}

        {!loading && error && (
          <div className="bg-red-50 border border-red-100 rounded-xl px-4 py-5 text-center space-y-1">
            <p className="text-sm font-semibold text-red-500">エラーが発生しました</p>
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}

        {!loading && checked && emails.length === 0 && !error && (
          <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
            重要メールはありません
          </div>
        )}

        {!loading && !checked && !error && (
          <div className="flex items-center justify-center py-16 text-gray-400 text-sm">
            「メールをチェック」を押すとClaudeが未読メールを分析します
          </div>
        )}

        {!loading && emails.map((email) => {
          const isExpanded = expanded.has(email.id);
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

              {isExpanded && email.reply_draft && (
                <div className="border-t border-gray-50 px-4 py-3">
                  <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-indigo-600">返信案</span>
                      <button
                        onClick={() => copyText(email.id, email.reply_draft)}
                        className="text-xs text-indigo-500 hover:text-indigo-700 transition-colors"
                      >
                        {copied === email.id ? "コピー済み ✓" : "コピー"}
                      </button>
                    </div>
                    <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{email.reply_draft}</p>
                  </div>
                </div>
              )}

              <div className="px-4 pb-3 flex gap-2">
                <button
                  onClick={() => toggleExpand(email.id)}
                  className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg px-2.5 py-1.5 transition-colors"
                >
                  {isExpanded ? "閉じる" : "返信案を見る"}
                </button>
              </div>
            </div>
          );
        })}
      </main>
    </div>
  );
}
