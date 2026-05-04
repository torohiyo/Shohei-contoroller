import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";
import OpenAI from "openai";

export const maxDuration = 60;

// ── OpenRouter ────────────────────────────────────────────────────────────

async function askAI(prompt: string): Promise<string> {
  if (!process.env.OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY が設定されていません");

  const client = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer": "https://shohei-contoroller.vercel.app",
      "X-Title": "Shohei Controller",
    },
  });

  const res = await client.chat.completions.create({
    model: "google/gemma-4-26b-a4b-it:free",
    messages: [{ role: "user", content: prompt }],
  });

  return res.choices[0].message.content ?? "";
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

    const prompt = `You are an email assistant for Matsumoto Shohei (松本頌平), CEO of Pacific Meta (shohei.matsumoto@pacific-meta.co.jp).

## Task
Analyze the unread emails below. Select important ones and draft replies in Matsumoto's voice.

## What counts as important
- Replies to his emails (hasReplyTo=true, or subject starts with "Re:")
- Contract/legal related (keywords: 契約, contract, agreement, NDA, 覚書, 署名, 規約)
- Emails from his team (@pacific-meta.co.jp domain, excluding himself)
- Personal emails from real individuals (not marketing/sales/newsletters)

## Exclude
- hasUnsubscribe=true
- From noreply, newsletter, automated senders
- Sales/marketing/promotional emails

## Reply style (match this exactly)
Japanese emails → reply in Japanese:
- Start with "〇〇様" (use sender's name if known)
- Opening: "お世話になります、松本です。" or "お世話になります。Pacific Metaの松本です。"
- Concise and direct — address the point immediately
- Warm but professional tone, use "！" occasionally
- End with "引き続きよろしくお願いいたします。\n\n松本"

English emails → reply in English:
- Professional but casual tone
- Direct and concise
- Sign off as "Shohei"

## Example Japanese reply
中山様

お世話になります、松本です。
ご連絡ありがとうございます！

5/8 15:00〜で私と岩崎の時間を確保させていただきます。
場所は前回と同じくフクラスに伺う形で問題ございませんでしょうか。

引き続きよろしくお願いいたします。

松本

---
## Emails to process

${emailList}

---

Respond ONLY with valid JSON, no markdown, no explanation:
{
  "important_emails": [
    {
      "id": "email id",
      "subject": "subject",
      "from": "sender",
      "date": "date",
      "reason": "reply_to_me or contract or team or personal",
      "snippet": "snippet",
      "reply_draft": "reply text in appropriate language"
    }
  ]
}`;

    const raw = await askAI(prompt);

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
