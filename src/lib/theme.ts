import { useEffect, useState } from "react";

export type Theme = "light" | "dark";
const KEY = "posto-theme";

function apply(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const stored = window.localStorage.getItem(KEY) as Theme | null;
    const initial: Theme =
      stored ??
      (window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark");
    setTheme(initial);
    apply(initial);
  }, []);

  const toggle = () => {
    setTheme((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      window.localStorage.setItem(KEY, next);
      apply(next);
      return next;
    });
  };

  return { theme, toggle };
}
