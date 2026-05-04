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

async function fetchSentThreadIds(token: string): Promise<Set<string>> {
  const data = await gmailFetch(token, "/messages?q=in:sent+newer_than:7d&maxResults=50");
  const messages: { id: string; threadId: string }[] = data.messages ?? [];
  return new Set(messages.map((m) => m.threadId));
}

async function fetchRecentEmails(token: string, sentThreadIds: Set<string>) {
  const data = await gmailFetch(token, "/messages?q=newer_than:2d+-from:me&maxResults=40");
  const messages: { id: string; threadId: string }[] = data.messages ?? [];
  if (!messages.length) return [];

  const summaries = await Promise.all(
    messages.slice(0, 25).map((m) =>
      gmailFetch(token, `/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=List-Unsubscribe`)
    )
  );

  return summaries.map((msg, i) => ({
    id: msg.id as string,
    threadId: messages[i].threadId,
    subject: getHeader(msg.payload?.headers ?? [], "subject") || "(件名なし)",
    from: getHeader(msg.payload?.headers ?? [], "from"),
    date: getHeader(msg.payload?.headers ?? [], "date"),
    isReplyToMe: sentThreadIds.has(messages[i].threadId),
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
    const sentThreadIds = await fetchSentThreadIds(token);
    const emails = await fetchRecentEmails(token, sentThreadIds);

    if (!emails.length) return NextResponse.json({ important_emails: [] });

    const emailList = emails.map((e, i) =>
      `[${i + 1}] ID:${e.id}\n件名: ${e.subject}\n送信者: ${e.from}\n日付: ${e.date}\n自分の送信スレへの返信: ${e.isReplyToMe}\n配信停止ヘッダー: ${e.hasUnsubscribe}\n概要: ${e.snippet}`
    ).join("\n\n---\n\n");

    const prompt = `以下は松本頌平（Pacific Meta CEO, shohei.matsumoto@pacific-meta.co.jp）宛の直近メール一覧です。対応が必要な重要メールのみを選別してください。

## 重要メールの条件（いずれかに該当）
1. 「自分の送信スレへの返信: true」のもの（確実に自分が送ったメールへの返信）
2. 件名に契約関連ワードが含まれる（契約・agreement・NDA・覚書・署名・規約など）
3. 送信者のドメインが @pacific-meta.co.jp（自分以外のチームメンバー）
4. 送信者の名前が明らかに個人名（山田太郎、Taro Yamada のような人名。会社名・サービス名・団体名は除く）

## 除外するもの
- 「配信停止ヘッダー: true」のメール
- noreply・no-reply・newsletter・info・support 等の自動送信アドレス
- 営業・マーケティング・セールス・イベント告知メール
- 送信者が明らかに企業・団体・サービス名のメール

## メール一覧
${emailList}

## 出力形式（JSONのみ。説明文・マークダウン不要）
{"important_emails":[{"id":"メールID","subject":"件名","from":"送信者","date":"日付","reason":"reply_to_me または contract または team または personal","snippet":"概要"}]}`;

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
