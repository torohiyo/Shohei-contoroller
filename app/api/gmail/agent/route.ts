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
  const data = await gmailFetch(token, "/messages?q=newer_than:2d+-from:me&maxResults=40");
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

    const prompt = `You are filtering emails for Matsumoto Shohei (松本頌平), CEO of Pacific Meta (shohei.matsumoto@pacific-meta.co.jp).

## Task
From the email list below, select only the important ones that need his attention.

## Important = any of these
- Replies to his emails (hasReplyTo=true, or subject starts with "Re:")
- Contract/legal (keywords: 契約, contract, agreement, NDA, 覚書, 署名, 規約)
- From his team (@pacific-meta.co.jp, excluding himself)
- Personal emails from real individuals

## Exclude
- hasUnsubscribe=true
- noreply / newsletter / automated senders
- Sales, marketing, promotional emails

## Emails
${emailList}

Respond ONLY with valid JSON, no markdown:
{
  "important_emails": [
    {
      "id": "email id",
      "subject": "subject",
      "from": "sender",
      "date": "date",
      "reason": "reply_to_me or contract or team or personal",
      "snippet": "snippet"
    }
  ]
}`;

    const raw = await askAI(prompt);

    // Extract JSON from response
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("JSONが返ってきませんでした");
    const result = JSON.parse(jsonMatch[0]);

    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "エラーが発生しました" }, { status: 500 });
  }
}
