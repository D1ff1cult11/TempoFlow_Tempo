import { useSyncExternalStore } from 'react';

export const THEMES = [
  { id: 'indigo', label: 'Indigo', swatch: '#8b7cff', name: 'A · Midnight indigo' },
  { id: 'amber', label: 'Amber', swatch: '#f5a623', name: 'C · Graphite amber' },
];

const KEY = 'tempoflow.theme';
const listeners = new Set();

function read() {
  try {
    const saved = localStorage.getItem(KEY);
    if (THEMES.some((t) => t.id === saved)) return saved;
  } catch {
    /* storage blocked */
  }
  return THEMES[0].id;
}

let current = read();
document.documentElement.dataset.theme = current;

export function setTheme(id) {
  current = id;
  document.documentElement.dataset.theme = id;
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* storage blocked: theme still applies for this visit */
  }
  listeners.forEach((l) => l());
}

export function useTheme() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
}
