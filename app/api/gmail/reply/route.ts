import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";
import OpenAI from "openai";

export const maxDuration = 60;

const FORMALITY_GUIDE: Record<number, string> = {
  1: "Very casual — like texting a close friend. Short sentences, casual Japanese (ため口), emoji OK.",
  2: "Casual and friendly. Light touch, no stiff phrasing.",
  3: "Friendly but clearly professional. 「〜ですね」「〜しますね」tone.",
  4: "Standard business. Normal 「〜です/〜ます」, warm but tidy.",
  5: "Balanced business email. Polite without being stiff.",
  6: "Business formal. 「〜いたします」「〜存じます」occasionally.",
  7: "Formal. Consistent 「〜いたします」「〜ております」.",
  8: "Very formal. 「〜でございます」, full keigo throughout.",
  9: "Highly ceremonial. Elaborate honorifics, classical phrasing.",
  10: "Maximum formality. Executive-grade keigo, no casual elements at all.",
};

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json({ error: "OPENROUTER_API_KEY が設定されていません" }, { status: 500 });
  }

  const { subject, from, body, snippet, answers, formality = 5, slots = [] } = await req.json();

  const client = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer": "https://shohei-contoroller.vercel.app",
      "X-Title": "Shohei Controller",
    },
  });

  const formalityLevel = Math.min(10, Math.max(1, Math.round(formality)));
  const formalityGuide = FORMALITY_GUIDE[formalityLevel] ?? FORMALITY_GUIDE[5];

  const answersSection = answers?.length
    ? `\n\n## Additional context from Shohei\n${answers.map((a: { question: string; answer: string }) => `Q: ${a.question}\nA: ${a.answer}`).join("\n\n")}`
    : "";

  const slotsSection = slots?.length
    ? `\n\n## Shohei's available time slots (use only if scheduling is relevant)\n${(slots as string[]).join("\n")}`
    : "";

  try {
    const res = await client.chat.completions.create({
      model: "google/gemini-2.0-flash-001",
      messages: [
        {
          role: "user",
          content: `You are writing an email reply for Matsumoto Shohei (松本頌平), CEO of Pacific Meta (shohei.matsumoto@pacific-meta.co.jp).

## Email to reply to
From: ${from}
Subject: ${subject}
Body: ${body || snippet}
${answersSection}
${slotsSection}

## Formality level: ${formalityLevel}/10
${formalityGuide}

## Language rule
- Japanese email → reply in Japanese
- English email → reply in English
- Mixed → match the dominant language

## Japanese reply structure (adjust formality as instructed above)
- Greeting: "〇〇様" (sender's family name)
- Opening line (choose based on context):
  - After a meeting: "貴重なお時間ありがとうございました。"
  - General: "お世話になります、松本です。" (adjust per formality)
- Body: concise, direct
- Closing: "引き続きよろしくお願いいたします。\n\n松本" (adjust per formality)

## English reply structure
- Sign off as "Shohei"

## Punctuation rule
- Use "！" at most ONCE per reply. Do not use multiple exclamation marks.

## Example reply (formality 5)
中山様

お世話になります、松本です。
ご連絡ありがとうございます！

5/8 15:00〜で私と岩崎の時間を確保させていただきます。
場所は前回と同じくフクラスに伺う形で問題ございませんでしょうか。

引き続きよろしくお願いいたします。

松本

Output the reply text ONLY. No subject line, no explanation, no markdown.`,
        },
      ],
    });

    const reply = res.choices[0].message.content ?? "";
    return NextResponse.json({ reply });
  } catch (e: any) {
    const message = e?.message ?? String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
