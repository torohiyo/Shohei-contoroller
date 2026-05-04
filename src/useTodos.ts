import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Todo, Category } from './types';

const STORAGE_KEY = '@todos';

export function useTodos() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const json = await AsyncStorage.getItem(STORAGE_KEY);
      if (json) setTodos(JSON.parse(json));
    } finally {
      setLoading(false);
    }
  }

  async function persist(updated: Todo[]) {
    setTodos(updated);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }

  const addTodo = useCallback(
    async (title: string, category: Category, note?: string) => {
      const todo: Todo = {
        id: Date.now().toString(),
        title,
        category,
        status: 'pending',
        note: note?.trim() || undefined,
        createdAt: new Date().toISOString(),
      };
      await persist([todo, ...todos]);
      return todo;
    },
    [todos]
  );

  const toggleTodo = useCallback(
    async (id: string) => {
      const updated = todos.map((t) =>
        t.id === id
          ? { ...t, status: t.status === 'completed' ? 'pending' : ('completed' as TodoStatus) }
          : t
      );
      await persist(updated);
    },
    [todos]
  );

  const deleteTodo = useCallback(
    async (id: string) => {
      await persist(todos.filter((t) => t.id !== id));
    },
    [todos]
  );

  return { todos, loading, addTodo, toggleTodo, deleteTodo };
}
