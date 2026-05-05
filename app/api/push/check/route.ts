import { NextResponse } from "next/server";
import { kv as redis } from "@/lib/kv";
import { sendPush } from "@/lib/push";
import webpush from "web-push";

export const maxDuration = 60;

const TEAM_DOMAIN = "pacific-meta.co.jp";
const USER_EMAIL = "shohei.matsumoto@pacific-meta.co.jp";
const CONTRACT_KEYWORDS = ["契約", "contract", "agreement", "nda", "覚書", "署名", "規約"];
const SPAM_FROM = /noreply|no-reply|newsletter|campaign|notification|info@(?!pacific)|support@(?!pacific)|admin@(?!pacific)/i;

function getHeader(headers: { name: string; value: string }[], name: string) {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    const data = await res.json();
    return data.access_token ?? null;
  } catch { return null; }
}

async function gmailFetch(token: string, path: string) {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

function isImportant(msg: any, sentThreadIds: Set<string>): boolean {
  const headers: { name: string; value: string }[] = msg.payload?.headers ?? [];
  const from = getHeader(headers, "from");
  const subject = getHeader(headers, "subject");
  const fromEmail = (from.match(/<(.+)>/) ?? [])[1] ?? from;
  const fromName = (from.match(/^"?([^"<]+)"?\s*</) ?? [])[1]?.trim() ?? "";

  if (headers.some((h) => h.name.toLowerCase() === "list-unsubscribe")) return false;
  if (SPAM_FROM.test(fromEmail)) return false;
  if (fromEmail.toLowerCase().includes(USER_EMAIL.toLowerCase())) return false;

  if (sentThreadIds.has(msg.threadId)) return true;
  if (CONTRACT_KEYWORDS.some((k) => subject.toLowerCase().includes(k))) return true;
  if (fromEmail.toLowerCase().includes(TEAM_DOMAIN)) return true;

  const hasSpaceInName = fromName.includes(" ") && fromName.length < 30;
  const hasJapaneseName = /[　-鿿]/.test(fromName);
  const isAutoSender = /[A-Z]{2,}|Inc\.|Ltd\.|Corp\.|Team|Support|Service|System|Alert|Update/i.test(fromName);
  if ((hasSpaceInName || hasJapaneseName) && !isAutoSender) return true;

  return false;
}

export async function GET(req: Request) {
  // Vercel Cron authentication
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get stored data from Redis
  const [subRaw, refreshToken, lastNotifiedRaw] = await Promise.all([
    redis.get<string>("push:subscription"),
    redis.get<string>("push:refresh_token"),
    redis.get<string>("push:last_notified_ids"),
  ]);

  if (!subRaw || !refreshToken) {
    return NextResponse.json({ skipped: "no subscription or token" });
  }

  const subscription: webpush.PushSubscription = typeof subRaw === "string" ? JSON.parse(subRaw) : subRaw as any;
  const lastNotifiedIds: string[] = lastNotifiedRaw ? JSON.parse(lastNotifiedRaw as string) : [];

  // Get fresh access token
  const accessToken = await refreshAccessToken(refreshToken);
  if (!accessToken) return NextResponse.json({ error: "token refresh failed" }, { status: 500 });

  // Fetch recent emails (last 1 hour)
  const [sentData, inboxData] = await Promise.all([
    gmailFetch(accessToken, "/messages?q=in:sent+newer_than:2d&maxResults=50"),
    gmailFetch(accessToken, "/messages?q=newer_than:1h+-from:me&maxResults=20"),
  ]);

  const sentThreadIds = new Set<string>((sentData.messages ?? []).map((m: any) => m.threadId));
  const messages: { id: string; threadId: string }[] = inboxData.messages ?? [];

  if (!messages.length) return NextResponse.json({ ok: true, found: 0 });

  // Get details for new messages only
  const newMessages = messages.filter((m) => !lastNotifiedIds.includes(m.id));
  if (!newMessages.length) return NextResponse.json({ ok: true, found: 0, note: "already notified" });

  const detailed = await Promise.all(
    newMessages.slice(0, 10).map((m) =>
      gmailFetch(accessToken, `/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=List-Unsubscribe`)
        .then((msg: any) => ({ ...msg, threadId: m.threadId }))
    )
  );

  const important = detailed.filter((msg) => isImportant(msg, sentThreadIds));
  if (!important.length) return NextResponse.json({ ok: true, found: 0 });

  // Send push notification
  const fromName = (getHeader(important[0].payload?.headers ?? [], "from").match(/^"?([^"<]+)"?\s*</) ?? [])[1]?.trim()
    || getHeader(important[0].payload?.headers ?? [], "from");
  const subject = getHeader(important[0].payload?.headers ?? [], "subject") || "(件名なし)";

  const title = important.length === 1
    ? `📧 ${fromName}`
    : `📧 重要メール ${important.length}件`;
  const body = important.length === 1
    ? subject
    : `${subject} 他${important.length - 1}件`;

  try {
    await sendPush(subscription, { title, body, url: "/mail", tag: "mail" });
  } catch (e: any) {
    // Subscription expired — clean up
    if (e.statusCode === 410) await redis.del("push:subscription");
    return NextResponse.json({ error: e.message }, { status: 500 });
  }

  // Save notified IDs (keep last 100)
  const allNotified = [...lastNotifiedIds, ...newMessages.map((m) => m.id)].slice(-100);
  await redis.set("push:last_notified_ids", JSON.stringify(allNotified));

  return NextResponse.json({ ok: true, notified: important.length });
}
