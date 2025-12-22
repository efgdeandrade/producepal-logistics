import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { Switch } from "@/components/ui/switch";

const getIsDark = () => {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains("dark");
};

const setIsDark = (dark: boolean) => {
  const root = document.documentElement;
  root.classList.toggle("dark", dark);
  root.classList.toggle("light", !dark);
  try {
    localStorage.setItem("theme", dark ? "dark" : "light");
  } catch {
    // ignore
  }
};

export function ThemeToggle() {
  const [isDark, setIsDarkState] = React.useState(getIsDark);

  React.useEffect(() => {
    // Initialize from storage if present
    try {
      const stored = localStorage.getItem("theme");
      if (stored === "dark" || stored === "light") {
        setIsDark(stored === "dark");
        setIsDarkState(stored === "dark");
        return;
      }
    } catch {
      // ignore
    }
    setIsDarkState(getIsDark());
  }, []);

  return (
    <div className="flex items-center justify-between w-full">
      <div className="flex items-center gap-2">
        {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        <span>Dark Mode</span>
      </div>
      <Switch
        checked={isDark}
        onCheckedChange={(checked) => {
          setIsDark(checked);
          setIsDarkState(checked);
        }}
      />
    </div>
  );
}
