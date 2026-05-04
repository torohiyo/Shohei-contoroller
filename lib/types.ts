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
