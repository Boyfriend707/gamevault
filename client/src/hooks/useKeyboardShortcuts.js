import { useEffect, useCallback, useRef } from "react";

const DEFAULT_BINDINGS = {
  "n": "add-game",
  "/": "search",
  "Escape": "close",
};

const LABELS = {
  "add-game": "New Game",
  "search": "Search",
  "close": "Close / Cancel",
};

class ShortcutBus {
  constructor() {
    this.listeners = {};
    this.enabled = true;
  }
  on(action, fn) {
    if (!this.listeners[action]) this.listeners[action] = [];
    this.listeners[action].push(fn);
    return () => { this.listeners[action] = this.listeners[action].filter((f) => f !== fn); };
  }
  emit(action) {
    if (!this.enabled) return;
    (this.listeners[action] || []).forEach((fn) => fn());
  }
  setEnabled(v) { this.enabled = v; }
}

export const shortcutBus = new ShortcutBus();

export function useShortcut(action, fn) {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  useEffect(() => shortcutBus.on(action, (...args) => fnRef.current(...args)), [action]);
}

export default function useKeyboardShortcuts(shortcutsEnabled, bindings = {}) {
  const resolvedBindings = { ...DEFAULT_BINDINGS, ...bindings };
  const reverseMap = {};
  for (const [key, action] of Object.entries(resolvedBindings)) {
    if (!reverseMap[action]) reverseMap[action] = [];
    reverseMap[action].push(key);
  }

  useEffect(() => {
    shortcutBus.setEnabled(shortcutsEnabled);
  }, [shortcutsEnabled]);

  const handler = useCallback((e) => {
    if (!shortcutsEnabled) return;
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable) {
      if (e.key === "Escape") {
        e.target.blur();
        shortcutBus.emit("close");
      }
      return;
    }

    const key = e.key === " " ? "Space" : e.key;
    const action = resolvedBindings[key.toLowerCase()] || resolvedBindings[key];

    if (action) {
      e.preventDefault();
      e.stopPropagation();
      shortcutBus.emit(action);
    }
  }, [shortcutsEnabled, resolvedBindings]);

  useEffect(() => {
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [handler]);
}

export function getShortcutKeys(action, bindings = {}) {
  const merged = { ...DEFAULT_BINDINGS, ...bindings };
  const keys = [];
  for (const [key, act] of Object.entries(merged)) {
    if (act === action) keys.push(key);
  }
  return keys;
}

export { DEFAULT_BINDINGS, LABELS };
