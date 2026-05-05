import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

export const maxDuration = 30;

function getHeader(headers: { name: string; value: string }[], name: string) {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function encodeBase64Url(str: string): string {
  return Buffer.from(str, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function mimeSubject(subject: string): string {
  if (/[^\x00-\x7F]/.test(subject)) {
    return `=?UTF-8?B?${Buffer.from(subject, "utf-8").toString("base64")}?=`;
  }
  return subject;
}

function buildRaw(params: {
  from: string;
  to: string;
  subject: string;
  body: string;
  inReplyTo?: string;
  references?: string;
}): string {
  const lines = [
    `From: ${params.from}`,
    `To: ${params.to}`,
    `Subject: ${mimeSubject(params.subject)}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=UTF-8`,
    `Content-Transfer-Encoding: 8bit`,
  ];
  if (params.inReplyTo) lines.push(`In-Reply-To: ${params.inReplyTo}`);
  if (params.references) lines.push(`References: ${params.references}`);
  lines.push("", params.body);
  return encodeBase64Url(lines.join("\r\n"));
}

async function gmailFetch(token: string, path: string, options?: RequestInit) {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(options?.headers ?? {}) },
  });
  return res.json();
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = session.accessToken as string;
  const { to, subject, body, originalMessageId } = await req.json();

  const FROM = "shohei.matsumoto@pacific-meta.co.jp";

  let inReplyTo: string | undefined;
  let references: string | undefined;
  let threadId: string | undefined;

  if (originalMessageId) {
    try {
      const orig = await gmailFetch(token, `/messages/${originalMessageId}?format=metadata&metadataHeaders=Message-ID&metadataHeaders=References`);
      inReplyTo = getHeader(orig.payload?.headers ?? [], "Message-ID") || undefined;
      const refs = getHeader(orig.payload?.headers ?? [], "References");
      references = [refs, inReplyTo].filter(Boolean).join(" ") || undefined;
      threadId = orig.threadId;
    } catch { /* 返信スレッド情報取得失敗は無視して新規送信にフォールバック */ }
  }

  const raw = buildRaw({ from: FROM, to, subject, body, inReplyTo, references });

  try {
    const result = await gmailFetch(token, "/messages/send", {
      method: "POST",
      body: JSON.stringify({ raw, ...(threadId ? { threadId } : {}) }),
    });

    if (result.error) return NextResponse.json({ error: result.error.message ?? JSON.stringify(result.error) }, { status: 400 });
    return NextResponse.json({ id: result.id, threadId: result.threadId });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
