import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { google } from "googleapis";
import { authOptions } from "@/lib/auth";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // クライアントのローカル日付（YYYY-MM-DD）を受け取る。未指定ならサーバーのUTC日付にフォールバック
  const { searchParams } = new URL(req.url);
  const dateParam = searchParams.get("date");
  const targetDateStr = dateParam ?? new Date().toISOString().slice(0, 10);

  // "YYYY-MM-DD" をそのままUTC midnight として解釈し、翌日0時を上限にする
  const startOfDay = new Date(`${targetDateStr}T00:00:00Z`);
  const endOfDay = new Date(`${targetDateStr}T23:59:59Z`);

  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: session.accessToken });

  const calendar = google.calendar({ version: "v3", auth });

  const res = await calendar.events.list({
    calendarId: "primary",
    timeMin: startOfDay.toISOString(),
    timeMax: endOfDay.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
  });

  const events = (res.data.items ?? [])
    // 複数日にまたがるイベントを除外: start が対象日付で始まるものだけ
    .filter((e) => {
      const start = e.start?.dateTime ?? e.start?.date ?? "";
      return start.startsWith(targetDateStr);
    })
    .map((e) => ({
      id: e.id,
      title: e.summary ?? "(タイトルなし)",
      start: e.start?.dateTime ?? e.start?.date,
      end: e.end?.dateTime ?? e.end?.date,
      isAllDay: !e.start?.dateTime,
    }));

  return NextResponse.json({ events });
}
