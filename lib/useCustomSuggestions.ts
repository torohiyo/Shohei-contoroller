"use client";

import { useState, useEffect, useCallback } from "react";
import { Category, CATEGORY_SUGGESTIONS } from "./types";

const STORAGE_KEY = "shohei-custom-suggestions";

type SuggestionsMap = Record<Category, string[]>;

function load(): SuggestionsMap | null {
  if (typeof window === "undefined") return null;
  try {
    const json = localStorage.getItem(STORAGE_KEY);
    return json ? JSON.parse(json) : null;
  } catch { return null; }
}

function save(map: SuggestionsMap) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

export function useCustomSuggestions() {
  const [suggestions, setSuggestions] = useState<SuggestionsMap>(CATEGORY_SUGGESTIONS as SuggestionsMap);

  useEffect(() => {
    const custom = load();
    if (custom) setSuggestions(custom);
  }, []);

  const persist = useCallback((updated: SuggestionsMap) => {
    setSuggestions(updated);
    save(updated);
  }, []);

  const addSuggestion = useCallback((category: Category, text: string) => {
    if (!text.trim()) return;
    persist({ ...suggestions, [category]: [...suggestions[category], text.trim()] });
  }, [suggestions, persist]);

  const removeSuggestion = useCallback((category: Category, index: number) => {
    const updated = suggestions[category].filter((_, i) => i !== index);
    persist({ ...suggestions, [category]: updated });
  }, [suggestions, persist]);

  const editSuggestion = useCallback((category: Category, index: number, text: string) => {
    if (!text.trim()) return;
    const updated = suggestions[category].map((s, i) => i === index ? text.trim() : s);
    persist({ ...suggestions, [category]: updated });
  }, [suggestions, persist]);

  const resetCategory = useCallback((category: Category) => {
    persist({ ...suggestions, [category]: [...CATEGORY_SUGGESTIONS[category]] });
  }, [suggestions, persist]);

  return { suggestions, addSuggestion, removeSuggestion, editSuggestion, resetCategory };
}
