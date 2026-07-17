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
}

export function Tabs({
  tabs,
  active,
  onChange,
  className,
  children,
}: TabsProps) {
  return (
    <ShadcnTabs
      value={active}
      onValueChange={onChange}
      className={cn("w-full", className)}
    >
      <TabsList className="mb-4 h-9 w-fit">
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
