export type Category = "work" | "home" | "other";
export type TodoStatus = "pending" | "completed";
export type Priority = "high" | "medium" | "low";

export interface Todo {
  id: string;
  title: string;
  category: Category;
  status: TodoStatus;
  priority: Priority;
  deadline?: string; // ISO string
  note?: string;
  createdAt: string;
}

export const CATEGORY_LABEL: Record<Category, string> = {
  work: "仕事",
  home: "家事",
  other: "その他",
};

export const CATEGORY_COLOR: Record<Category, { bg: string; text: string; border: string }> = {
  work: { bg: "bg-indigo-100", text: "text-indigo-600", border: "border-indigo-500" },
  home: { bg: "bg-emerald-100", text: "text-emerald-600", border: "border-emerald-500" },
  other: { bg: "bg-amber-100", text: "text-amber-600", border: "border-amber-500" },
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
