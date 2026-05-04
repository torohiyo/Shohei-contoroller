import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Gmail API helpers ──────────────────────────────────────────────────────

function getHeader(headers: { name: string; value: string }[], name: string) {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

function extractBody(payload: any): string {
  if (!payload) return "";
  if (payload.body?.data) {
    return Buffer.from(payload.body.data, "base64url").toString("utf-8");
  }
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        return Buffer.from(part.body.data, "base64url").toString("utf-8");
      }
    }
    for (const part of payload.parts) {
      const text = extractBody(part);
      if (text) return text;
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

// ── Tool implementations ──────────────────────────────────────────────────

async function listUnreadEmails(token: string) {
  const data = await gmailFetch(token, "/messages?q=is:unread+-from:me&maxResults=30");
  const messages: { id: string }[] = data.messages ?? [];
  if (!messages.length) return { emails: [] };

  const summaries = await Promise.all(
    messages.map((m) =>
      gmailFetch(token, `/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date&metadataHeaders=In-Reply-To&metadataHeaders=List-Unsubscribe`)
    )
  );

  return {
    emails: summaries.map((msg) => ({
      id: msg.id,
      subject: getHeader(msg.payload?.headers ?? [], "subject") || "(件名なし)",
      from: getHeader(msg.payload?.headers ?? [], "from"),
      date: getHeader(msg.payload?.headers ?? [], "date"),
      has_reply_to: !!getHeader(msg.payload?.headers ?? [], "in-reply-to"),
      has_unsubscribe: !!getHeader(msg.payload?.headers ?? [], "list-unsubscribe"),
      snippet: msg.snippet ?? "",
    })),
  };
}

async function getEmailBody(token: string, email_id: string) {
  const msg = await gmailFetch(token, `/messages/${email_id}?format=full`);
  const body = extractBody(msg.payload).slice(0, 3000);
  return { body };
}

async function markAsRead(token: string, email_ids: string[]) {
  await Promise.all(
    email_ids.map((id) =>
      gmailFetch(token, `/messages/${id}/modify`, {
        method: "POST",
        body: JSON.stringify({ removeLabelIds: ["UNREAD"] }),
      })
    )
  );
  return { ok: true, marked: email_ids.length };
}

// ── Tool definitions ──────────────────────────────────────────────────────

const TOOLS: Anthropic.Tool[] = [
  {
    name: "list_unread_emails",
    description: "Gmailの未読メール一覧を取得する。件名・送信者・日付・スニペットが含まれる。",
    input_schema: { type: "object" as const, properties: {} },
  },
  {
    name: "get_email_body",
    description: "特定メールの本文を取得する。重要度判定が難しい場合に使う。",
    input_schema: {
      type: "object" as const,
      properties: { email_id: { type: "string", description: "メールのID" } },
      required: ["email_id"],
    },
  },
  {
    name: "mark_as_read",
    description: "指定したメールを既読にする。",
    input_schema: {
      type: "object" as const,
      properties: {
        email_ids: { type: "array", items: { type: "string" }, description: "既読にするメールIDの配列" },
      },
      required: ["email_ids"],
    },
  },
  {
    name: "output_result",
    description: "処理結果を出力する。必ず最後に呼び出す。",
    input_schema: {
      type: "object" as const,
      properties: {
        important_emails: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              subject: { type: "string" },
              from: { type: "string" },
              date: { type: "string" },
              reason: { type: "string", enum: ["reply_to_me", "contract", "team", "personal"] },
              snippet: { type: "string" },
              reply_draft: { type: "string", description: "日本語の返信案。末尾に「松本翔平」署名を含める。" },
            },
            required: ["id", "subject", "from", "date", "reason", "snippet", "reply_draft"],
          },
        },
      },
      required: ["important_emails"],
    },
  },
];

// ── Agent loop ────────────────────────────────────────────────────────────

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY が設定されていません" }, { status: 500 });
  }

  const token = session.accessToken as string;

  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `あなたはShohei Matsumoto（shohei.matsumoto@pacific-meta.co.jp, Pacific Meta）のメールアシスタントです。

以下の手順でGmailを処理してください：
1. list_unread_emails で未読メール一覧を取得
2. 各メールを確認し、必要なら get_email_body で本文を取得
3. 重要メールを以下の基準で判定：
   - 自分への返信（In-Reply-To あり / 件名が "Re:" で始まる）
   - 契約関連（契約・contract・agreement・NDA・覚書・署名・規約 などが件名に含まれる）
   - チームからのメール（@pacific-meta.co.jp ドメイン）
   - 個人からのメール（実在する人物からで営業・マーケ・ニュースレターでないもの）
4. 重要メールごとに日本語返信案を作成（ビジネス敬語、末尾に「松本翔平」署名）
5. output_result で結果を出力
6. mark_as_read で全未読メール（重要・不要問わず）を既読にする

営業メール・マーケティング・ニュースレター（List-Unsubscribe ヘッダーあり、noreply送信元など）は除外してください。`,
    },
  ];

  let finalResult: { important_emails: object[] } | null = null;

  for (let i = 0; i < 10; i++) {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      tools: TOOLS,
      messages,
    });

    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason === "end_turn") break;

    const toolUses = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (!toolUses.length) break;

    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const toolUse of toolUses) {
      let result: unknown;
      const input = toolUse.input as Record<string, any>;

      try {
        switch (toolUse.name) {
          case "list_unread_emails":
            result = await listUnreadEmails(token);
            break;
          case "get_email_body":
            result = await getEmailBody(token, input.email_id);
            break;
          case "mark_as_read":
            result = await markAsRead(token, input.email_ids);
            break;
          case "output_result":
            finalResult = input as { important_emails: object[] };
            result = { ok: true };
            break;
          default:
            result = { error: "unknown tool" };
        }
      } catch (e: any) {
        result = { error: e?.message ?? "tool error" };
      }

      toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, content: JSON.stringify(result) });
    }

    messages.push({ role: "user", content: toolResults });

    if (finalResult) break;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return NextResponse.json((finalResult as any) ?? { important_emails: [] });
}
