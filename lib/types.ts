export type Category = "work" | "home" | "training" | "english" | "hobby" | "other";
export type TodoStatus = "pending" | "completed";
export type Priority = "high" | "medium" | "low";

export interface Todo {
  id: string;
  title: string;
  category: Category;
  status: TodoStatus;
  priority: Priority;
  deadline?: string;
  note?: string;
  createdAt: string;
}

export type RecurringType = "daily" | "weekly" | "biweekly" | "monthly";

export interface RecurringTask {
  id: string;
  title: string;
  category: Category;
  priority: Priority;
  recurring: RecurringType;
  weekDays?: number[]; // 0=日, 1=月, ..., 6=土
  monthDay?: number;   // 1-31
  deadlineTimeSlot?: number; // 0-48
  note?: string;
  createdAt: string;
}

export const RECURRING_LABEL: Record<RecurringType, string> = {
  daily: "毎日",
  weekly: "毎週",
  biweekly: "隔週",
  monthly: "毎月",
};

export const CATEGORY_SUGGESTIONS: Record<Category, string[]> = {
  work:     ["メールチェック・返信", "MTG設定", "提案書作成", "リサーチ", "会議資料作成", "進捗確認", "タスク整理"],
  home:     ["掃除", "洗濯", "料理", "買い物", "ゴミ出し", "片付け", "水やり"],
  training: ["ランニング", "筋トレ", "ストレッチ", "ジム", "ヨガ", "ウォーキング"],
  english:  ["単語学習", "リスニング", "スピーキング練習", "音読", "文法学習", "英語日記"],
  hobby:    ["読書", "映画鑑賞", "ゲーム", "音楽", "イラスト", "料理"],
  other:    ["メモ整理", "計画作成", "振り返り", "連絡", "手続き"],
};

export interface ShoppingItem {
  id: string;
  name: string;
  bought: boolean;
  createdAt: string;
}

export const CATEGORY_LABEL: Record<Category, string> = {
  work: "仕事",
  home: "家事",
  training: "トレーニング",
  english: "英語学習",
  hobby: "趣味",
  other: "その他",
};

export const CATEGORY_COLOR: Record<Category, { bg: string; text: string; border: string }> = {
  work:     { bg: "bg-indigo-100",  text: "text-indigo-600",  border: "border-indigo-500" },
  home:     { bg: "bg-emerald-100", text: "text-emerald-600", border: "border-emerald-500" },
  training: { bg: "bg-orange-100",  text: "text-orange-600",  border: "border-orange-500" },
  english:  { bg: "bg-blue-100",    text: "text-blue-600",    border: "border-blue-500" },
  hobby:    { bg: "bg-purple-100",  text: "text-purple-600",  border: "border-purple-500" },
  other:    { bg: "bg-gray-100",    text: "text-gray-600",    border: "border-gray-400" },
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  high: "高",
  medium: "中",
  low: "低",
};

export const PRIORITY_COLOR: Record<Priority, string> = {
  high: "text-red-500",
  medium: "text-amber-500",
  low: "text-gray-400",
};
