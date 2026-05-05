import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";
import OpenAI from "openai";

export const maxDuration = 60;

const FORMALITY_GUIDE: Record<number, string> = {
  1: "Very casual — like texting a close friend. Short sentences, casual Japanese (ため口).",
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
  if (!process.env.OPENROUTER_API_KEY) return NextResponse.json({ error: "OPENROUTER_API_KEY が設定されていません" }, { status: 500 });

  const { to, subject, notes, formality = 5 } = await req.json();

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

  try {
    const res = await client.chat.completions.create({
      model: "google/gemini-2.0-flash-001",
      messages: [
        {
          role: "user",
          content: `You are writing an email on behalf of Matsumoto Shohei (松本頌平), CEO of Pacific Meta (shohei.matsumoto@pacific-meta.co.jp).

## Recipient
To: ${to}

## Subject hint
${subject || "(not specified — infer from notes)"}

## Rough notes from Shohei
${notes}

## Formality level: ${formalityLevel}/10
${formalityGuide}

## Language rule
- Detect the language from the recipient address / notes. Default to Japanese.
- Japanese structure: 「〇〇様\n\nお世話になります、松本です。\n\n[body]\n\n引き続きよろしくお願いいたします。\n\n松本」
- English structure: professional, sign off as "Shohei"

## Punctuation rule
- Use "！" at most ONCE per email.

Respond with valid JSON only:
{"subject": "...", "body": "..."}`,
        },
      ],
    });

    const raw = res.choices[0].message.content ?? "";
    const match = raw.match(/\{[\s\S]*\}/);
    const data = JSON.parse(match?.[0] ?? "{}");
    return NextResponse.json({ subject: data.subject ?? subject ?? "", body: data.body ?? "" });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
