"use client";

import { format } from "date-fns";
import { Briefcase, MapPin, Pencil, Trash2 } from "lucide-react";

import { UpdateJobDialog } from "@/components/careers/update-job-dialog";
import { Badge } from "@/components/shared/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Job } from "@/services/career.service";

interface JobCardProps {
  job: Job;
  canEdit?: boolean;
  canDelete?: boolean;
  onDeleteJob?: (jobId: string) => void;
  onJobUpdated?: (job: Job) => void;
}

export function JobCard({
  job,
  canEdit,
  canDelete,
  onDeleteJob,
  onJobUpdated,
}: JobCardProps) {
  return (
    <Card
      className={`
        transition-shadow
        hover:shadow-md
      `}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-foreground line-clamp-2 text-sm font-semibold">
            {job.title}
          </h3>
          <Badge status={job.active ? "active" : "draft"}>
            {job.active ? "Active" : "Draft"}
          </Badge>
        </div>

        <p className="text-muted-foreground mt-1 text-[11px]">
          {job.department}
        </p>

        <div className="mt-3 flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5 text-[11px]">
            <Briefcase className="text-muted-foreground size-3 shrink-0" />
            <span className="text-muted-foreground">{job.type}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[11px]">
            <MapPin className="text-muted-foreground size-3 shrink-0" />
            <span className="text-muted-foreground">{job.location}</span>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <p className="text-muted-foreground/60 text-[10px]">
            {format(new Date(job.createdAt), "MMM d, yyyy")}
          </p>
          {job._count.applications > 0 && (
            <span className="text-muted-foreground text-[10px]">
              {job._count.applications} app
              {job._count.applications !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {(canDelete || canEdit) && (
          <div className="mt-3 flex items-center justify-between border-t pt-3">
            {canDelete ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="xs"
                    className={`
                      text-destructive
                      hover:bg-destructive/10
                    `}
                  >
                    <Trash2 className="size-3" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      Are you absolutely sure?
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete
                      this job posting and all associated applications.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onDeleteJob?.(job.id)}>
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : (
              <div />
            )}

            {canEdit && (
              <UpdateJobDialog
                job={job}
                onJobUpdated={onJobUpdated}
                trigger={
                  <Button variant="outline" size="xs">
                    <Pencil className="size-3" />
                    Edit
                  </Button>
                }
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
