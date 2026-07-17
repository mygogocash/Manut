import { Building2, Users } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import type { Department } from "@/services/directory.service";

export function DepartmentSummary({
  departments,
  onSelect,
}: {
  departments: Department[];
  onSelect: (dept: string) => void;
}) {
  const total = departments.reduce((s, d) => s + d.count, 0);

  return (
    <div
      className={`
        mb-6 grid grid-cols-2 gap-3
        sm:grid-cols-3
        lg:grid-cols-4
        xl:grid-cols-6
      `}
    >
      <Card
        className={`
          cursor-pointer transition-shadow
          hover:shadow-md
        `}
        onClick={() => onSelect("")}
      >
        <CardContent className="p-3">
          <div
            className={`
              bg-primary/10 text-primary mb-2 flex size-7 items-center
              justify-center rounded-lg
            `}
          >
            <Users className="size-3.5" />
          </div>
          <p className="text-foreground text-lg font-semibold tabular-nums">
            {total}
          </p>
          <p
            className={`
              text-muted-foreground text-[10px] font-bold tracking-wider
              uppercase
            `}
          >
            All Employees
          </p>
        </CardContent>
      </Card>
      {departments.map((dept) => (
        <Card
          key={dept.name}
          className={`
            cursor-pointer transition-shadow
            hover:shadow-md
          `}
          onClick={() => onSelect(dept.name)}
        >
          <CardContent className="p-3">
            <div
              className={`
                bg-info/10 text-info mb-2 flex size-7 items-center
                justify-center rounded-lg
              `}
            >
              <Building2 className="size-3.5" />
            </div>
            <p className="text-foreground text-lg font-semibold tabular-nums">
              {dept.count}
            </p>
            <p
              className={`
                text-muted-foreground truncate text-[10px] font-bold
                tracking-wider uppercase
              `}
            >
              {dept.name}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
