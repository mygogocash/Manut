"use client";

import dayjs from "dayjs";
import {
  Briefcase,
  Building2,
  Calendar,
  ExternalLink,
  FileText,
  Link2,
  Mail,
  Phone,
  User,
} from "lucide-react";
import { type ReactNode } from "react";

import { Badge } from "@/components/shared/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Application } from "@/services/application.service";

interface ApplicationDetailDialogProps {
  application: Application;
  trigger: ReactNode;
}

export function ApplicationDetailDialog({
  application,
  trigger,
}: ApplicationDetailDialogProps) {
  const initials = application.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Application Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <div
              className={`
                bg-primary/10 text-primary flex size-12 items-center
                justify-center rounded-full text-sm font-bold
              `}
            >
              {initials}
            </div>
            <div>
              <p className="text-foreground text-sm font-semibold">
                {application.name}
              </p>
              {application.job && (
                <Badge status="active" className="mt-1">
                  {application.job.title}
                </Badge>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <p
              className={`
                text-muted-foreground text-[9.5px] font-bold tracking-[0.12em]
                uppercase
              `}
            >
              Contact Information
            </p>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-[12.5px]">
                <Mail className="text-muted-foreground size-3.5 shrink-0" />
                <a
                  href={`mailto:${application.email}`}
                  className={`
                    text-primary
                    hover:underline
                  `}
                >
                  {application.email}
                </a>
              </div>
              <div className="flex items-center gap-2 text-[12.5px]">
                <Phone className="text-muted-foreground size-3.5 shrink-0" />
                <a
                  href={`tel:${application.mobile}`}
                  className="hover:underline"
                >
                  {application.mobile}
                </a>
              </div>
              {application.linkedin && (
                <div className="flex items-center gap-2 text-[12.5px]">
                  <Link2 className="text-muted-foreground size-3.5 shrink-0" />
                  <a
                    href={application.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`
                      text-primary
                      hover:underline
                    `}
                  >
                    LinkedIn Profile
                    <ExternalLink className="ml-1 inline size-3" />
                  </a>
                </div>
              )}
              {application.website && (
                <div className="flex items-center gap-2 text-[12.5px]">
                  <User className="text-muted-foreground size-3.5 shrink-0" />
                  <a
                    href={application.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`
                      text-primary
                      hover:underline
                    `}
                  >
                    Portfolio / Website
                    <ExternalLink className="ml-1 inline size-3" />
                  </a>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <p
              className={`
                text-muted-foreground text-[9.5px] font-bold tracking-[0.12em]
                uppercase
              `}
            >
              Application Details
            </p>
            <div className="flex flex-col gap-2">
              {application.job && (
                <>
                  <div className="flex items-center gap-2 text-[12.5px]">
                    <Briefcase
                      className={`text-muted-foreground size-3.5 shrink-0`}
                    />
                    <span>
                      <span className="text-muted-foreground">Position: </span>
                      <span className="text-foreground">
                        {application.job.title}
                      </span>
                    </span>
                  </div>
                  {application.job.department && (
                    <div className="flex items-center gap-2 text-[12.5px]">
                      <Building2
                        className={`text-muted-foreground size-3.5 shrink-0`}
                      />
                      <span>
                        <span className="text-muted-foreground">
                          Department:{" "}
                        </span>
                        <span className="text-foreground">
                          {application.job.department}
                        </span>
                      </span>
                    </div>
                  )}
                </>
              )}
              <div className="flex items-center gap-2 text-[12.5px]">
                <Calendar className="text-muted-foreground size-3.5 shrink-0" />
                <span>
                  <span className="text-muted-foreground">Applied: </span>
                  <span className="text-foreground">
                    {dayjs(application.createdAt).format("MMMM D, YYYY h:mm A")}
                  </span>
                </span>
              </div>
            </div>
          </div>

          {application.attachment && (
            <div className="pt-1">
              <Button asChild className="w-full">
                <a
                  href={application.attachment}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <FileText className="mr-2 size-3.5" />
                  View Resume
                  <ExternalLink className="ml-2 size-3.5" />
                </a>
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
