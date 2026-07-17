"use client";

import { Loader2, Search } from "lucide-react";
import { useMemo } from "react";

import {
  ALL_MODULES,
  humanizeModule,
} from "@/components/roles/role-form-schema";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PermissionDef } from "@/services/role.service";

interface PermissionPickerProps {
  permsByModule: Record<string, PermissionDef[]>;
  loadingPerms: boolean;
  selectedPerms: Set<string>;
  onTogglePerm: (code: string) => void;
  onToggleModule: (moduleName: string) => void;
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  moduleFilter: string;
  onModuleFilterChange: (value: string) => void;
}

export function PermissionPicker({
  permsByModule,
  loadingPerms,
  selectedPerms,
  onTogglePerm,
  onToggleModule,
  searchQuery,
  onSearchQueryChange,
  moduleFilter,
  onModuleFilterChange,
}: PermissionPickerProps) {
  const moduleNames = useMemo(
    () => Object.keys(permsByModule).sort(),
    [permsByModule],
  );

  const filteredModules = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return moduleNames
      .filter((m) => moduleFilter === ALL_MODULES || m === moduleFilter)
      .map((moduleName) => {
        const perms = permsByModule[moduleName].filter(
          (p) =>
            !query ||
            p.code.toLowerCase().includes(query) ||
            p.description.toLowerCase().includes(query),
        );
        return { moduleName, perms };
      })
      .filter((m) => m.perms.length > 0);
  }, [moduleNames, permsByModule, searchQuery, moduleFilter]);

  if (loadingPerms) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className={`text-muted-foreground size-5 animate-spin`} />
      </div>
    );
  }

  return (
    <>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search
            className={`
              text-muted-foreground absolute top-1/2 left-2.5 size-3.5
              -translate-y-1/2
            `}
          />
          <Input
            placeholder="Search permissions..."
            value={searchQuery}
            onChange={(e) => onSearchQueryChange(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>
        <Select value={moduleFilter} onValueChange={onModuleFilterChange}>
          <SelectTrigger className="h-10 w-44 text-xs">
            <SelectValue placeholder="All modules" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_MODULES}>All modules</SelectItem>
            {moduleNames.map((m) => (
              <SelectItem key={m} value={m}>
                {humanizeModule(m)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div
        className={`
          border-border scrollbar-thin flex flex-col gap-4 rounded-lg border p-3
        `}
      >
        {filteredModules.length === 0 ? (
          <p className={`text-muted-foreground py-6 text-center text-sm`}>
            No permissions match your search
          </p>
        ) : (
          filteredModules.map(
            ({
              moduleName,
              perms: modulePerms,
            }: {
              moduleName: string;
              perms: PermissionDef[];
            }) => {
              const allModulePerms = permsByModule[moduleName];
              const allSelected = allModulePerms.every((p) =>
                selectedPerms.has(p.code),
              );
              const someSelected =
                !allSelected &&
                allModulePerms.some((p) => selectedPerms.has(p.code));
              const selectedCount = allModulePerms.filter((p) =>
                selectedPerms.has(p.code),
              ).length;

              return (
                <div key={moduleName}>
                  <label
                    className={`mb-2 flex cursor-pointer items-center gap-2`}
                  >
                    <Checkbox
                      checked={
                        allSelected
                          ? true
                          : someSelected
                            ? "indeterminate"
                            : false
                      }
                      onCheckedChange={() => onToggleModule(moduleName)}
                    />
                    <span className={`text-foreground text-xs font-semibold`}>
                      {humanizeModule(moduleName)}
                    </span>
                    <span
                      className={`
                        text-muted-foreground text-[10px] tabular-nums
                      `}
                    >
                      ({selectedCount}/{allModulePerms.length})
                    </span>
                  </label>
                  <div
                    className={`
                      ml-6 grid grid-cols-1 gap-1.5
                      sm:grid-cols-2
                      lg:grid-cols-3
                    `}
                  >
                    {modulePerms.map((perm) => {
                      const isChecked = selectedPerms.has(perm.code);
                      return (
                        <label
                          key={perm.code}
                          className={`
                            flex cursor-pointer items-start gap-2 rounded-md
                            border p-2 transition-colors
                            ${
                              isChecked
                                ? `border-primary/40 bg-primary/5`
                                : `
                                  border-border
                                  hover:border-muted-foreground/30
                                  hover:bg-muted/30
                                `
                            }
                          `}
                        >
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={() => onTogglePerm(perm.code)}
                            className="mt-0.5"
                          />
                          <div className="min-w-0">
                            <p
                              className={`
                                font-mono text-[10px] leading-tight font-medium
                              `}
                            >
                              {perm.code}
                            </p>
                            <p
                              className={`
                                text-muted-foreground mt-0.5 text-[10px]
                                leading-snug
                              `}
                            >
                              {perm.description}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            },
          )
        )}
      </div>
    </>
  );
}
