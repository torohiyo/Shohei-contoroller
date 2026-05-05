import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextResponse } from "next/server";

export const maxDuration = 30;

const WORK_START = 9 * 60;   // 9:00 in minutes
const WORK_END = 19 * 60;    // 19:00 in minutes
const MIN_SLOT = 30;
const DAY_NAMES = ["日", "月", "火", "水", "木", "金", "土"];
const JST = 9 * 60 * 60 * 1000;

function jst(utc: Date) {
  const d = new Date(utc.getTime() + JST);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    dow: d.getUTCDay(),
    minutes: d.getUTCHours() * 60 + d.getUTCMinutes(),
    key: `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`,
  };
}

function fmt(min: number) {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = session.accessToken as string;
  const now = new Date();
  const timeMin = now.toISOString();
  const timeMax = new Date(now.getTime() + 31 * 24 * 60 * 60 * 1000).toISOString();

  try {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime&maxResults=200`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json();
    const events: any[] = data.items ?? [];

    // Build busy map by date key
    const busy: Record<string, { start: number; end: number }[]> = {};
    for (const ev of events) {
      if (ev.transparency === "transparent") continue;
      const startDt = ev.start?.dateTime;
      const endDt = ev.end?.dateTime;
      if (!startDt || !endDt) continue; // all-day events skipped

      const s = jst(new Date(startDt));
      const e = jst(new Date(endDt));
      if (!busy[s.key]) busy[s.key] = [];
      busy[s.key].push({
        start: s.minutes,
        end: e.key === s.key ? e.minutes : WORK_END,
      });
    }

    // Generate free slots for next 10 weekdays
    const slots: string[] = [];
    for (let i = 0; i < 31 && slots.length < 30; i++) {
      const d = jst(new Date(now.getTime() + i * 24 * 60 * 60 * 1000));
      if (d.dow === 0 || d.dow === 6) continue;

      const todayBusy = (busy[d.key] ?? []).sort((a, b) => a.start - b.start);
      const freeRanges: string[] = [];
      let cursor = WORK_START;

      for (const b of todayBusy) {
        const freeEnd = Math.min(b.start, WORK_END);
        if (freeEnd - cursor >= MIN_SLOT) {
          freeRanges.push(`${fmt(cursor)}〜${fmt(freeEnd)}`);
        }
        cursor = Math.max(cursor, b.end);
      }
      if (WORK_END - cursor >= MIN_SLOT) {
        freeRanges.push(`${fmt(cursor)}〜${fmt(WORK_END)}`);
      }

      if (freeRanges.length > 0) {
        slots.push(`${d.month}月${d.day}日 (${DAY_NAMES[d.dow]}) ${freeRanges.join(", ")}`);
      }
    }

    return NextResponse.json({ slots });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
