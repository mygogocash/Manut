"use client";

import { UserMinus } from "lucide-react";

import {
  formatCurrency,
  formatDate,
} from "@/components/benefits/benefits-utils";
import { Badge } from "@/components/shared/badge";
import { Modal, ModalActions } from "@/components/shared/modal";
import { Button } from "@/components/ui/button";
import { type BenefitDetail } from "@/services/benefit.service";

interface DetailDialogProps {
  open: boolean;
  onClose: () => void;
  benefit: BenefitDetail | null;
  canManage: boolean;
  onUnenroll: (enrollmentId: string) => void;
}

export function BenefitDetailDialog({
  open,
  onClose,
  benefit,
  canManage,
  onUnenroll,
}: DetailDialogProps) {
  if (!benefit) return null;

  const activeEnrollments = benefit.enrollments.filter(
    (e) => e.status === "active",
  );

  return (
    <Modal open={open} onClose={onClose} title={benefit.name} size="lg">
      <div className="mt-3 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-muted-foreground">Category</span>
            <p className="font-medium capitalize">{benefit.category}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Provider</span>
            <p className="font-medium">{benefit.provider ?? "—"}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Cost</span>
            <p className="font-medium tabular-nums">
              {formatCurrency(benefit.cost, benefit.currency)}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Status</span>
            <p>
              <Badge status={benefit.isActive ? "active" : "inactive"}>
                {benefit.isActive ? "Active" : "Inactive"}
              </Badge>
            </p>
          </div>
          {benefit.description && (
            <div className="col-span-2">
              <span className="text-muted-foreground">Description</span>
              <p className="mt-0.5">{benefit.description}</p>
            </div>
          )}
        </div>

        <div>
          <h4
            className={`
              text-muted-foreground mb-2 text-[10px] font-bold tracking-widest
              uppercase
            `}
          >
            Enrolled Employees ({activeEnrollments.length})
          </h4>
          {activeEnrollments.length === 0 ? (
            <p className="text-muted-foreground text-xs">
              No employees enrolled
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {activeEnrollments.map((e) => (
                <div
                  key={e.id}
                  className={`
                    bg-surface-secondary flex items-center justify-between
                    rounded-md px-3 py-2 text-xs
                  `}
                >
                  <div>
                    <span className="font-medium">{e.employee.name}</span>
                    <span className="text-muted-foreground ml-2">
                      {e.employee.email}
                    </span>
                    <span className="text-muted-foreground ml-2">
                      since {formatDate(e.startDate)}
                    </span>
                  </div>
                  {canManage && (
                    <Button
                      variant="ghost"
                      size="xs"
                      className="text-destructive text-xs"
                      onClick={() => onUnenroll(e.id)}
                    >
                      <UserMinus className="mr-1 size-3" />
                      Unenroll
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <ModalActions>
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </ModalActions>
    </Modal>
  );
}
