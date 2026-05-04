"use client";

import { useState, useEffect, useCallback } from "react";
import { RecurringTask, Category, Priority } from "./types";

const STORAGE_KEY = "shohei-recurring";
const GENERATED_KEY = "shohei-recurring-generated";

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function load(): RecurringTask[] {
  if (typeof window === "undefined") return [];
  try {
    const json = localStorage.getItem(STORAGE_KEY);
    return json ? JSON.parse(json) : [];
  } catch { return []; }
}

function loadGenerated(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const json = localStorage.getItem(`${GENERATED_KEY}-${todayKey()}`);
    return new Set(json ? JSON.parse(json) : []);
  } catch { return new Set(); }
}

function saveGenerated(ids: Set<string>) {
  localStorage.setItem(`${GENERATED_KEY}-${todayKey()}`, JSON.stringify([...ids]));
}

function getWeekNumber(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 1);
  return Math.floor((date.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000));
}

function shouldRunToday(task: RecurringTask): boolean {
  const now = new Date();
  const dow = now.getDay();
  const dom = now.getDate();

  if (task.recurring === "daily") return true;
  if (task.recurring === "weekly") return (task.weekDays ?? []).includes(dow);
  if (task.recurring === "biweekly") {
    if (!(task.weekDays ?? []).includes(dow)) return false;
    const createdWeek = getWeekNumber(new Date(task.createdAt));
    const currentWeek = getWeekNumber(now);
    return (currentWeek - createdWeek) % 2 === 0;
  }
  if (task.recurring === "monthly") return task.monthDay === dom;
  return false;
}

export function useRecurringTasks() {
  const [tasks, setTasks] = useState<RecurringTask[]>([]);

  useEffect(() => {
    setTasks(load());
  }, []);

  const persist = useCallback((updated: RecurringTask[]) => {
    setTasks(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }, []);

  const addRecurring = useCallback(
    (params: Omit<RecurringTask, "id" | "createdAt">) => {
      const task: RecurringTask = {
        ...params,
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
      };
      persist([...tasks, task]);
      return task;
    },
    [tasks, persist]
  );

  const deleteRecurring = useCallback(
    (id: string) => { persist(tasks.filter((t) => t.id !== id)); },
    [tasks, persist]
  );

  // 今日実行すべき定期タスクを返す（未生成のもののみ）
  const getTodayPending = useCallback((): RecurringTask[] => {
    const generated = loadGenerated();
    return tasks.filter((t) => shouldRunToday(t) && !generated.has(t.id));
  }, [tasks]);

  const markGenerated = useCallback((ids: string[]) => {
    const generated = loadGenerated();
    ids.forEach((id) => generated.add(id));
    saveGenerated(generated);
  }, []);

  return { tasks, addRecurring, deleteRecurring, getTodayPending, markGenerated };
}
