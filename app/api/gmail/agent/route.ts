import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

export const maxDuration = 60;

// ── ChatGPT unofficial access ─────────────────────────────────────────────

async function askChatGPT(prompt: string): Promise<string> {
  const sessionToken = process.env.CHATGPT_SESSION_TOKEN;
  if (!sessionToken) throw new Error("CHATGPT_SESSION_TOKEN が設定されていません");

  const res = await fetch("https://chat.openai.com/backend-api/conversation", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      "Content-Type": "application/json",
      Accept: "text/event-stream",
      Cookie: `__Secure-next-auth.session-token=${sessionToken}`,
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Referer: "https://chat.openai.com/",
      Origin: "https://chat.openai.com",
    },
    body: JSON.stringify({
      action: "next",
      messages: [{
        id: crypto.randomUUID(),
        author: { role: "user" },
        content: { content_type: "text", parts: [prompt] },
      }],
      model: "gpt-4o",
      parent_message_id: crypto.randomUUID(),
      timezone_offset_min: -540,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ChatGPT API エラー: ${res.status} ${text.slice(0, 200)}`);
  }

  // Parse SSE stream — take the last data line before [DONE]
  const text = await res.text();
  const lines = text.split("\n").filter((l) => l.startsWith("data: ") && !l.includes("[DONE]"));
  if (!lines.length) throw new Error("ChatGPT からレスポンスがありませんでした");

  const lastData = JSON.parse(lines[lines.length - 1].replace("data: ", ""));
  return lastData?.message?.content?.parts?.[0] ?? "";
}

// ── Gmail API helpers ──────────────────────────────────────────────────────

function getHeader(headers: { name: string; value: string }[], name: string) {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function extractBody(payload: any): string {
  if (!payload) return "";
  if (payload.body?.data) return Buffer.from(payload.body.data, "base64url").toString("utf-8");
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data)
        return Buffer.from(part.body.data, "base64url").toString("utf-8");
    }
    for (const part of payload.parts) {
      const t = extractBody(part);
      if (t) return t;
    }
  }
  return "";
}

async function gmailFetch(token: string, path: string, options?: RequestInit) {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(options?.headers ?? {}) },
  });
  return res.json();
}

async function fetchUnreadEmails(token: string) {
  const data = await gmailFetch(token, "/messages?q=is:unread+-from:me&maxResults=30");
  const messages: { id: string }[] = data.messages ?? [];
  if (!messages.length) return [];

  const summaries = await Promise.all(
    messages.slice(0, 20).map((m) =>
      gmailFetch(token, `/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=In-Reply-To&metadataHeaders=List-Unsubscribe`)
    )
  );

  return summaries.map((msg) => ({
    id: msg.id as string,
    subject: getHeader(msg.payload?.headers ?? [], "subject") || "(件名なし)",
    from: getHeader(msg.payload?.headers ?? [], "from"),
    date: getHeader(msg.payload?.headers ?? [], "date"),
    hasReplyTo: !!getHeader(msg.payload?.headers ?? [], "in-reply-to"),
    hasUnsubscribe: !!getHeader(msg.payload?.headers ?? [], "list-unsubscribe"),
    snippet: (msg.snippet ?? "") as string,
  }));
}

async function markAllAsRead(token: string, ids: string[]) {
  await Promise.all(
    ids.map((id) =>
      gmailFetch(token, `/messages/${id}/modify`, {
        method: "POST",
        body: JSON.stringify({ removeLabelIds: ["UNREAD"] }),
      })
    )
  );
}

// ── Main handler ──────────────────────────────────────────────────────────

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = session.accessToken as string;

  try {
    const emails = await fetchUnreadEmails(token);

    if (!emails.length) return NextResponse.json({ important_emails: [] });

    const emailList = emails.map((e, i) =>
      `[${i + 1}] ID:${e.id}\n件名: ${e.subject}\n送信者: ${e.from}\n日付: ${e.date}\n返信メール: ${e.hasReplyTo}\n配信停止ヘッダー: ${e.hasUnsubscribe}\n概要: ${e.snippet}`
    ).join("\n\n---\n\n");

    const prompt = `あなたはShohei Matsumoto（shohei.matsumoto@pacific-meta.co.jp, Pacific Meta）のメールアシスタントです。

以下の未読メール一覧を分析して、重要なメールを選別し返信案を作成してください。

重要メールの基準：
- 自分への返信（返信メール=true、または件名が"Re:"で始まる）
- 契約関連（契約・contract・agreement・NDA・覚書・署名・規約 などが件名に含まれる）
- チームからのメール（@pacific-meta.co.jp ドメイン）
- 個人からのメール（実在する人物からで営業・マーケ・ニュースレターでないもの）

除外：配信停止ヘッダー=true、noreply送信元、マーケティング・営業メール

---
${emailList}
---

以下のJSON形式のみで回答してください（説明文・マークダウン不要）：
{
  "important_emails": [
    {
      "id": "メールID",
      "subject": "件名",
      "from": "送信者",
      "date": "日付",
      "reason": "reply_to_me または contract または team または personal",
      "snippet": "概要",
      "reply_draft": "日本語の返信案（ビジネス敬語、末尾に「松本翔平」署名）"
    }
  ]
}`;

    const raw = await askChatGPT(prompt);

    // Extract JSON from response
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("JSONが返ってきませんでした");
    const result = JSON.parse(jsonMatch[0]);

    // Mark all fetched emails as read
    await markAllAsRead(token, emails.map((e) => e.id));

    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "エラーが発生しました" }, { status: 500 });
  }
}
