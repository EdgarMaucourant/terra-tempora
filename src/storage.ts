// Choices remembered in this browser. Storage can be blocked or full: the app
// then works the same and forgets the choice when the page reloads.

export function stored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Remembers a value, or forgets it (null). */
export function store(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Not remembered, then.
  }
}
