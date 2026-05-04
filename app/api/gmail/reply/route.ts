import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { subject, from, body } = await req.json();

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY が設定されていません" }, { status: 500 });
  }

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `あなたはShohei Matsumoto（Pacific Meta, shohei.matsumoto@pacific-meta.co.jp）のメール返信アシスタントです。

以下のメールへの返信文章を日本語で作成してください。
- ビジネスメールとして自然な敬語で書く
- 相手の要件に対して具体的に応答する
- 末尾に「松本」と署名を入れる（日本語メールは「松本」、英語メールは「Shohei」）
- 件名・区切り線・説明文は不要、返信本文のみ出力

送信者: ${from}
件名: ${subject}

メール本文:
${body}`,
        },
      ],
    });

    const reply = message.content[0].type === "text" ? message.content[0].text : "";
    return NextResponse.json({ reply });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Anthropic APIエラー" }, { status: 500 });
  }
}
