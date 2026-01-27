import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { Switch } from "@/components/ui/switch";

const STORAGE_KEY = "theme";

function applyTheme(dark: boolean) {
  const root = document.documentElement;
  // Remove both classes first to ensure clean state
  root.classList.remove("dark", "light");
  // Add the correct class
  root.classList.add(dark ? "dark" : "light");
  
  try {
    localStorage.setItem(STORAGE_KEY, dark ? "dark" : "light");
  } catch {
    // localStorage might be unavailable
  }
}

function getStoredTheme(): boolean | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "dark") return true;
    if (stored === "light") return false;
  } catch {
    // ignore
  }
  return null;
}

function getCurrentTheme(): boolean {
  // First check localStorage
  const stored = getStoredTheme();
  if (stored !== null) return stored;
  
  // Then check DOM
  if (typeof document !== "undefined") {
    return document.documentElement.classList.contains("dark");
  }
  
  return false; // default to light
}

export function ThemeToggle() {
  const [isDark, setIsDark] = React.useState(getCurrentTheme);

  // Sync with DOM on mount and ensure correct initial state
  React.useEffect(() => {
    const currentTheme = getCurrentTheme();
    setIsDark(currentTheme);
    applyTheme(currentTheme);
  }, []);

  const handleToggle = React.useCallback((checked: boolean) => {
    setIsDark(checked);
    applyTheme(checked);
  }, []);

  return (
    <div className="flex items-center justify-between w-full">
      <div className="flex items-center gap-2">
        {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        <span>Dark Mode</span>
      </div>
      <Switch
        checked={isDark}
        onCheckedChange={handleToggle}
      />
    </div>
  );
}
