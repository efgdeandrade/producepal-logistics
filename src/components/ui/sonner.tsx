import * as React from "react";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

type SonnerTheme = ToasterProps["theme"];

const getThemeFromDom = (): SonnerTheme => {
  if (typeof document === "undefined") return "system";
  const cls = document.documentElement.classList;
  if (cls.contains("dark")) return "dark";
  if (cls.contains("light")) return "light";
  return "system";
};

const Toaster = ({ ...props }: ToasterProps) => {
  const [theme, setTheme] = React.useState<SonnerTheme>(() => getThemeFromDom());

  React.useEffect(() => {
    // Keep Sonner theme in sync with DOM class without relying on next-themes hooks.
    const observer = new MutationObserver(() => setTheme(getThemeFromDom()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
