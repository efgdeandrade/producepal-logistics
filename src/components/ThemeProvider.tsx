import * as React from "react";

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: "light" | "dark";
  storageKey?: string;
}

export function ThemeProvider({
  children,
  defaultTheme = "light",
  storageKey = "theme",
}: ThemeProviderProps) {
  React.useEffect(() => {
    const root = document.documentElement;

    let theme = defaultTheme;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored === "light" || stored === "dark") theme = stored;
    } catch {
      // ignore
    }

    root.classList.toggle("dark", theme === "dark");
    root.classList.toggle("light", theme === "light");
  }, [defaultTheme, storageKey]);

  return <>{children}</>;
}
