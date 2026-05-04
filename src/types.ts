export type Category = 'work' | 'home' | 'other';
export type TodoStatus = 'pending' | 'completed';

export interface Todo {
  id: string;
  title: string;
  category: Category;
  status: TodoStatus;
  note?: string;
  createdAt: string;
}

export const CATEGORY_LABEL: Record<Category, string> = {
  work: '仕事',
  home: '家事',
  other: 'その他',
};

export const CATEGORY_COLOR: Record<Category, string> = {
  work: '#5B5FEF',
  home: '#10B981',
  other: '#F59E0B',
};
