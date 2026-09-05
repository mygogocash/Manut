"use client";

import {
  Tabs as ShadcnTabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface Tab {
  id: string;
  label: string;
  count?: number;
}

interface TabsProps {
  tabs: Tab[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
  children?: React.ReactNode;
  /**
   * `"line"` renders underlined triggers on a transparent track instead of
   * the filled pill.
   *
   * Use it when this strip sits UNDER another one, so the two levels don't
   * read as one undifferentiated block of tabs — the outer strip keeps the
   * pill, the nested strip gets the lighter treatment. Defaults to the pill
   * so every existing call site is unchanged.
   */
  variant?: "default" | "line";
}

export function Tabs({
  tabs,
  active,
  onChange,
  className,
  children,
  variant = "default",
}: TabsProps) {
  return (
    <ShadcnTabs
      value={active}
      onValueChange={onChange}
      className={cn("w-full", className)}
    >
      <TabsList variant={variant} className="mb-4 h-9 w-fit">
        {tabs.map((tab) => (
          <TabsTrigger key={tab.id} value={tab.id} className="px-3 text-xs">
            {tab.label}
            {tab.count !== undefined && (
              <span className="text-muted-foreground ml-1.5 text-[10px]">
                ({tab.count})
              </span>
            )}
          </TabsTrigger>
        ))}
      </TabsList>
      {children}
    </ShadcnTabs>
  );
}

export { TabsContent };
