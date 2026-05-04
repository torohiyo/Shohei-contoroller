import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

const USER_EMAIL = "shohei.matsumoto@pacific-meta.co.jp";
const TEAM_DOMAIN = "pacific-meta.co.jp";

const CONTRACT_KEYWORDS = ["契約", "contract", "agreement", "nda", "覚書", "合意", "署名", "規約", "利用規約"];
const SALES_HEADER_PATTERN = /list-unsubscribe/i;
const SALES_FROM_PATTERN = /noreply|no-reply|newsletter|marketing|campaign|notification|support@(?!pacific)/i;
const SALES_SUBJECT_KEYWORDS = ["キャンペーン", "セール", "特価", "割引", "クーポン", "プロモーション", "ご案内", "お知らせ"];

function getHeader(headers: { name: string; value: string }[], name: string) {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function getBody(payload: any): string {
  if (!payload) return "";
  if (payload.body?.data) {
    return Buffer.from(payload.body.data, "base64url").toString("utf-8");
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        return Buffer.from(part.body.data, "base64url").toString("utf-8");
      }
    }
    for (const part of payload.parts) {
      const text = getBody(part);
      if (text) return text;
    }
  }
  return "";
}

function classifyEmail(msg: any): { important: boolean; reason: string } {
  const headers: { name: string; value: string }[] = msg.payload?.headers ?? [];
  const from = getHeader(headers, "from");
  const subject = getHeader(headers, "subject");
  const inReplyTo = getHeader(headers, "in-reply-to");
  const references = getHeader(headers, "references");
  const hasUnsubscribe = headers.some((h) => SALES_HEADER_PATTERN.test(h.name));

  if (hasUnsubscribe) return { important: false, reason: "" };
  if (SALES_FROM_PATTERN.test(from)) return { important: false, reason: "" };
  if (SALES_SUBJECT_KEYWORDS.some((k) => subject.includes(k))) return { important: false, reason: "" };

  const subjectLower = subject.toLowerCase();
  if (CONTRACT_KEYWORDS.some((k) => subjectLower.includes(k.toLowerCase()))) {
    return { important: true, reason: "contract" };
  }

  const fromEmail = from.match(/<(.+)>/)?.[1] ?? from;
  if (fromEmail.includes(TEAM_DOMAIN) && !fromEmail.includes(USER_EMAIL)) {
    return { important: true, reason: "team" };
  }

  if (inReplyTo || references) {
    return { important: true, reason: "reply_to_me" };
  }

  const isPersonal =
    !SALES_FROM_PATTERN.test(fromEmail) &&
    !fromEmail.includes("bot") &&
    !fromEmail.includes("auto") &&
    fromEmail.includes("@");

  if (isPersonal) return { important: true, reason: "personal" };

  return { important: false, reason: "" };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = session.accessToken as string;

  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:unread+-from:me&maxResults=40`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!listRes.ok) {
    const errData = await listRes.json();
    const errMsg = errData?.error?.message ?? listRes.statusText;
    return NextResponse.json({ error: errMsg, status: listRes.status }, { status: listRes.status });
  }

  const listData = await listRes.json();
  const messages: { id: string }[] = listData.messages ?? [];

  if (!messages.length) return NextResponse.json({ emails: [] });

  const detailed = await Promise.all(
    messages.slice(0, 30).map((m) =>
      fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=full`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json())
    )
  );

  const emails = detailed
    .filter((msg) => msg.payload)
    .map((msg) => {
      const { important, reason } = classifyEmail(msg);
      if (!important) return null;
      const headers = msg.payload.headers;
      return {
        id: msg.id,
        threadId: msg.threadId,
        subject: getHeader(headers, "subject") || "(件名なし)",
        from: getHeader(headers, "from"),
        date: getHeader(headers, "date"),
        reason,
        snippet: msg.snippet ?? "",
        body: getBody(msg.payload).slice(0, 3000),
      };
    })
    .filter(Boolean);

  return NextResponse.json({ emails });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { ids }: { ids: string[] } = await req.json();
  const token = session.accessToken as string;

  await Promise.all(
    ids.map((id) =>
      fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}/modify`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ removeLabelIds: ["UNREAD"] }),
      })
    )
  );

  return NextResponse.json({ ok: true });
}
