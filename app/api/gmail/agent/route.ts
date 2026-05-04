import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

export const maxDuration = 60;

const USER_EMAIL = "shohei.matsumoto@pacific-meta.co.jp";
const TEAM_DOMAIN = "pacific-meta.co.jp";
const CONTRACT_KEYWORDS = ["契約", "contract", "agreement", "nda", "覚書", "署名", "規約"];
const SPAM_FROM = /noreply|no-reply|newsletter|campaign|notification|info@(?!pacific)|support@(?!pacific)|admin@(?!pacific)/i;

function getHeader(headers: { name: string; value: string }[], name: string) {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

async function gmailFetch(token: string, path: string, options?: RequestInit) {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(options?.headers ?? {}) },
  });
  return res.json();
}

async function fetchSentThreadIds(token: string): Promise<Set<string>> {
  const data = await gmailFetch(token, "/messages?q=in:sent+newer_than:7d&maxResults=50");
  const messages: { id: string; threadId: string }[] = data.messages ?? [];
  return new Set(messages.map((m) => m.threadId));
}

function classify(msg: any, sentThreadIds: Set<string>): { important: boolean; reason: string } {
  const headers: { name: string; value: string }[] = msg.payload?.headers ?? [];
  const from = getHeader(headers, "from");
  const subject = getHeader(headers, "subject");
  const hasUnsubscribe = headers.some((h) => h.name.toLowerCase() === "list-unsubscribe");
  const fromEmail = (from.match(/<(.+)>/) ?? [])[1] ?? from;
  const fromName = (from.match(/^"?([^"<]+)"?\s*</) ?? [])[1]?.trim() ?? "";

  // 除外
  if (hasUnsubscribe) return { important: false, reason: "" };
  if (SPAM_FROM.test(fromEmail)) return { important: false, reason: "" };
  if (fromEmail.toLowerCase().includes(USER_EMAIL.toLowerCase())) return { important: false, reason: "" };

  // 自分が送ったスレへの返信
  if (sentThreadIds.has(msg.threadId)) return { important: true, reason: "reply_to_me" };

  // 契約関連
  if (CONTRACT_KEYWORDS.some((k) => subject.toLowerCase().includes(k))) return { important: true, reason: "contract" };

  // チーム
  if (fromEmail.toLowerCase().includes(TEAM_DOMAIN)) return { important: true, reason: "team" };

  // 個人名判定: 名前部分にスペースが含まれる or 日本語名 (漢字/ひらがな)
  const hasSpaceInName = fromName.includes(" ") && fromName.length < 30;
  const hasJapaneseName = /[　-鿿]/.test(fromName);
  const isAutoSender = /[A-Z]{2,}|Inc\.|Ltd\.|Corp\.|Team|Support|Service|System|Alert|Update/i.test(fromName);
  if ((hasSpaceInName || hasJapaneseName) && !isAutoSender) return { important: true, reason: "personal" };

  return { important: false, reason: "" };
}

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = session.accessToken as string;

  const [sentData, inboxData] = await Promise.all([
    fetchSentThreadIds(token),
    gmailFetch(token, "/messages?q=newer_than:2d+-from:me&maxResults=40"),
  ]);

  const messages: { id: string; threadId: string }[] = inboxData.messages ?? [];
  if (!messages.length) return NextResponse.json({ important_emails: [], _debug: { step: "no_messages", inboxError: inboxData.error } });

  const detailed = await Promise.all(
    messages.slice(0, 30).map((m) =>
      gmailFetch(token, `/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=List-Unsubscribe`)
        .then((msg) => ({ ...msg, threadId: m.threadId }))
    )
  );

  const classified = detailed.map((msg) => {
    const { important, reason } = classify(msg, sentData);
    const headers = msg.payload?.headers ?? [];
    return {
      id: msg.id,
      from: getHeader(headers, "from"),
      subject: getHeader(headers, "subject"),
      important,
      reason,
    };
  });

  const important = classified
    .filter((r) => r.important)
    .map((r) => {
      const msg = detailed.find((m) => m.id === r.id)!;
      const headers = msg.payload?.headers ?? [];
      return {
        id: msg.id as string,
        subject: getHeader(headers, "subject") || "(件名なし)",
        from: getHeader(headers, "from"),
        date: getHeader(headers, "date"),
        reason: r.reason,
        snippet: (msg.snippet ?? "") as string,
      };
    });

  return NextResponse.json({
    important_emails: important,
    _debug: {
      total_fetched: messages.length,
      sent_thread_count: sentData.size,
      classified: classified.map((c) => ({ from: c.from, subject: c.subject, important: c.important, reason: c.reason })),
    },
  });
}
