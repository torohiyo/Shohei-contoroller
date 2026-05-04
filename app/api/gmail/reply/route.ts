import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json({ error: "OPENROUTER_API_KEY が設定されていません" }, { status: 500 });
  }

  const { subject, from, body, snippet, answers } = await req.json();

  const client = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer": "https://shohei-contoroller.vercel.app",
      "X-Title": "Shohei Controller",
    },
  });

  const answersSection = answers?.length
    ? `\n\nAdditional context from Shohei:\n${answers.map((a: { question: string; answer: string }) => `Q: ${a.question}\nA: ${a.answer}`).join("\n\n")}`
    : "";

  const res = await client.chat.completions.create({
    model: "google/gemma-4-26b-a4b-it:free",
    messages: [
      {
        role: "user",
        content: `You are writing an email reply for Matsumoto Shohei (松本頌平), CEO of Pacific Meta (shohei.matsumoto@pacific-meta.co.jp).

## Email to reply to
From: ${from}
Subject: ${subject}
Body: ${body || snippet}
${answersSection}

## Writing style
Japanese emails → reply in Japanese:
- Start with "〇〇様" (use sender's family name)
- "お世話になります、松本です。" or "お世話になります。Pacific Metaの松本です。"
- Concise and direct, warm tone, use "！" occasionally
- End with "引き続きよろしくお願いいたします。\n\n松本"

English emails → reply in English:
- Professional but casual and direct
- Sign off as "Shohei"

## Example Japanese reply
中山様

お世話になります、松本です。
ご連絡ありがとうございます！

5/8 15:00〜で私と岩崎の時間を確保させていただきます。
場所は前回と同じくフクラスに伺う形で問題ございませんでしょうか。

引き続きよろしくお願いいたします。

松本

Output the reply text ONLY. No subject, no explanation, no markdown.`,
      },
    ],
  });

  const reply = res.choices[0].message.content ?? "";
  return NextResponse.json({ reply });
}
