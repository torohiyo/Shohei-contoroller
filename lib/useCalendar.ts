"use client";

import { useState, useEffect } from "react";

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  isAllDay: boolean;
}

export function useCalendar() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/calendar")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch");
        return r.json();
      })
      .then((data) => setEvents(data.events))
      .catch(() => setError("カレンダーの取得に失敗しました"))
      .finally(() => setLoading(false));
  }, []);

  return { events, loading, error };
}
