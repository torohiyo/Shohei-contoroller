"use client";

import { useState, useEffect, useCallback } from "react";
import { ShoppingItem } from "./types";

const STORAGE_KEY = "shohei-shopping";

function load(): ShoppingItem[] {
  if (typeof window === "undefined") return [];
  try {
    const json = localStorage.getItem(STORAGE_KEY);
    return json ? JSON.parse(json) : [];
  } catch {
    return [];
  }
}

function save(items: ShoppingItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function useShoppingList() {
  const [items, setItems] = useState<ShoppingItem[]>([]);

  useEffect(() => {
    setItems(load());
  }, []);

  const persist = useCallback((updated: ShoppingItem[]) => {
    setItems(updated);
    save(updated);
  }, []);

  const addItem = useCallback(
    (name: string) => {
      const item: ShoppingItem = {
        id: Date.now().toString(),
        name: name.trim(),
        bought: false,
        createdAt: new Date().toISOString(),
      };
      persist([...items, item]);
    },
    [items, persist]
  );

  const toggleItem = useCallback(
    (id: string) => {
      persist(items.map((i) => (i.id === id ? { ...i, bought: !i.bought } : i)));
    },
    [items, persist]
  );

  const deleteItem = useCallback(
    (id: string) => {
      persist(items.filter((i) => i.id !== id));
    },
    [items, persist]
  );

  const clearBought = useCallback(() => {
    persist(items.filter((i) => !i.bought));
  }, [items, persist]);

  return { items, addItem, toggleItem, deleteItem, clearBought };
}
