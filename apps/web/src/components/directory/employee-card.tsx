import { Building2, Mail, MapPin, Phone, Users } from "lucide-react";

import { Avatar } from "@/components/shared/avatar";
import { Badge } from "@/components/shared/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { DirectoryEmployee } from "@/services/directory.service";

export function EmployeeCard({
  employee,
  onClick,
}: {
  employee: DirectoryEmployee;
  onClick: () => void;
}) {
  return (
    <Card
      className={`
        cursor-pointer transition-shadow
        hover:shadow-md
      `}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Avatar name={employee.name} src={employee.avatarUrl} size="lg" />
          <div className="min-w-0 flex-1">
            <p className="text-foreground truncate text-sm font-semibold">
              {employee.name}
            </p>
            <p className="text-muted-foreground truncate text-[11px]">
              {employee.jobTitle ?? "—"}
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-col gap-1.5">
          {employee.department && (
            <div className="flex items-center gap-1.5 text-[11px]">
              <Building2 className="text-muted-foreground size-3 shrink-0" />
              <span className="text-muted-foreground truncate">
                {employee.department}
              </span>
            </div>
          )}
          {employee.entity && (
            <div className="flex items-center gap-1.5 text-[11px]">
              <Users className="text-muted-foreground size-3 shrink-0" />
              <span className="text-muted-foreground truncate">
                {employee.entity.name}
              </span>
            </div>
          )}
          <div className="flex items-center gap-1.5 text-[11px]">
            <Mail className="text-muted-foreground size-3 shrink-0" />
            <span className="text-muted-foreground truncate">
              {employee.email}
            </span>
          </div>
          {employee.phone && (
            <div className="flex items-center gap-1.5 text-[11px]">
              <Phone className="text-muted-foreground size-3 shrink-0" />
              <span className="text-muted-foreground truncate">
                {employee.phone}
              </span>
            </div>
          )}
          {employee.location && (
            <div className="flex items-center gap-1.5 text-[11px]">
              <MapPin className="text-muted-foreground size-3 shrink-0" />
              <span className="text-muted-foreground truncate">
                {employee.location}
              </span>
            </div>
          )}
        </div>
        <div className="mt-3">
          <Badge status={employee.employmentType}>
            {employee.employmentType.replace("_", " ")}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
