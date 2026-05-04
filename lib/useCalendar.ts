"use client";

import { useState, useEffect } from "react";

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  isAllDay: boolean;
}

export interface CalendarTaskEvent extends CalendarEvent {
  cleanTitle: string; // [task]を除いたタイトル
}

function isTaskEvent(title: string) {
  return /\[task\]/i.test(title);
}

function cleanTitle(title: string) {
  return title.replace(/\[task\]/gi, "").trim();
}

export function useCalendar() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [taskEvents, setTaskEvents] = useState<CalendarTaskEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/calendar")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch");
        return r.json();
      })
      .then((data) => {
        const all: CalendarEvent[] = data.events;
        setEvents(all.filter((e) => !isTaskEvent(e.title)));
        setTaskEvents(
          all
            .filter((e) => isTaskEvent(e.title))
            .map((e) => ({ ...e, cleanTitle: cleanTitle(e.title) }))
        );
      })
      .catch(() => setError("カレンダーの取得に失敗しました"))
      .finally(() => setLoading(false));
  }, []);

  return { events, taskEvents, loading, error };
}
