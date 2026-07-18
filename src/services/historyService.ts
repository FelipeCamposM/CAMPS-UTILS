import type { HistoryEntry } from "../types/conversion";

const STORAGE_KEY = "pdf-to-markdown-history";
const MAX_ENTRIES = 50;

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as HistoryEntry[];
  } catch {
    return [];
  }
}

export function saveHistory(entries: HistoryEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Silently fail
  }
}

export function addHistoryEntry(
  entries: HistoryEntry[],
  entry: HistoryEntry
): HistoryEntry[] {
  const updated = [entry, ...entries];
  return updated.slice(0, MAX_ENTRIES);
}

export function removeHistoryEntry(
  entries: HistoryEntry[],
  id: string
): HistoryEntry[] {
  return entries.filter((e) => e.id !== id);
}
