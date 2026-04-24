import { useState, useEffect } from 'react';

const STORAGE_KEY = 'sotara-theme';

export function useTheme() {
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return stored === 'dark';
      // Respect OS preference on first visit
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.setAttribute('data-theme', 'dark');
    } else {
      root.removeAttribute('data-theme');
    }
    try {
      localStorage.setItem(STORAGE_KEY, isDark ? 'dark' : 'light');
    } catch { /* storage not available */ }
  }, [isDark]);

  const toggleTheme = () => setIsDark((d) => !d);

  return { isDark, toggleTheme };
}
