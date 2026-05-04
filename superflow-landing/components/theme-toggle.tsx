"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export function ThemeToggle() {
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch — render a stable placeholder until mounted.
  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Toggle color theme"
        className={cn(
          "inline-flex size-9 items-center justify-center rounded-full border border-border/60 bg-background/40 text-muted-foreground",
          "transition-colors hover:text-foreground hover:bg-muted",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "[&_svg]:size-4"
        )}
      >
        {mounted ? (
          <span className="relative inline-flex size-4">
            <Sun
              aria-hidden
              className="absolute inset-0 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0"
            />
            <Moon
              aria-hidden
              className="absolute inset-0 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100"
            />
          </span>
        ) : (
          <Sun aria-hidden />
        )}
        <span className="sr-only">Toggle theme</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[140px]">
        <DropdownMenuItem onClick={() => setTheme("light")} aria-current={theme === "light"}>
          <Sun className="size-4" aria-hidden />
          Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")} aria-current={theme === "dark"}>
          <Moon className="size-4" aria-hidden />
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")} aria-current={theme === "system"}>
          <Monitor className="size-4" aria-hidden />
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
