import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";
import OpenAI from "openai";

export const maxDuration = 60;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.OPENROUTER_API_KEY) {
    return NextResponse.json({ error: "OPENROUTER_API_KEY が設定されていません" }, { status: 500 });
  }

  const { subject, from, snippet, body } = await req.json();

  const client = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer": "https://shohei-contoroller.vercel.app",
      "X-Title": "Shohei Controller",
    },
  });

  try {
    const res = await client.chat.completions.create({
      model: "google/gemma-4-26b-a4b-it:free",
      messages: [
        {
          role: "user",
          content: `You are helping Matsumoto Shohei (松本頌平, Pacific Meta) reply to an email.

Email details:
From: ${from}
Subject: ${subject}
Body: ${body || snippet}

Your task: Identify what information you need from Shohei to write a good reply. Ask 1-3 concise questions in the same language as the email (Japanese if Japanese, English if English).

Only ask what is genuinely unclear or missing. If the reply is obvious (e.g., a simple thank-you), return an empty list.

Respond ONLY with valid JSON, no markdown:
{"questions": ["question 1", "question 2"]}`,
        },
      ],
    });

    const raw = res.choices[0].message.content ?? "";
    const match = raw.match(/\{[\s\S]*\}/);
    const data = JSON.parse(match?.[0] ?? '{"questions":[]}');
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ questions: [] });
  }
}
