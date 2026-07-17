"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  size?: "default" | "lg" | "xl";
  children: React.ReactNode;
}

const SIZE_MAP = {
  default: "sm:max-w-[480px]",
  lg: "sm:max-w-[680px]",
  xl: "sm:max-w-[900px]",
};

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  size = "default",
  children,
}: ModalProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent
        className={cn(
          "bg-surface rounded-[14px] p-6 shadow-lg",
          SIZE_MAP[size],
        )}
      >
        <DialogHeader className="gap-0.5">
          <DialogTitle className="font-sans text-xl font-normal">
            {title}
          </DialogTitle>
          {subtitle && (
            <DialogDescription className="text-muted-foreground text-[11px]">
              {subtitle}
            </DialogDescription>
          )}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

export function ModalActions({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Separator className="mt-4" />
      <DialogFooter className="flex justify-end gap-2 bg-transparent pt-4">
        {children}
      </DialogFooter>
    </>
  );
}
