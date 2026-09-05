"use client";

import { ImageIcon, Loader2, Upload, X } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { uploadFile } from "@/services/upload.service";

/**
 * Image types the PUBLIC `uploads` bucket accepts.
 *
 * Mirrors the server allowlist rather than testing `image/*`. SVG is missing on
 * purpose and must stay missing: the bucket is public, and an SVG served from a
 * CDN path can execute embedded script in an HTML context, which hands an
 * authenticated employee a stored-XSS vector against teammates. Checking
 * `image/*` here would let one through to a 415 the user cannot interpret.
 */
export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
] as const;

const ACCEPT_ATTR = ACCEPTED_IMAGE_TYPES.join(",");

export function isAcceptedImage(file: { type: string }): boolean {
  return (ACCEPTED_IMAGE_TYPES as readonly string[]).includes(file.type);
}

/** First file on a drop, whether the browser exposes `files` or `items`. */
export function firstFileFrom(dt: DataTransfer): File | null {
  if (dt.files && dt.files.length > 0) return dt.files[0] ?? null;
  if (dt.items) {
    for (const item of dt.items) {
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file) return file;
      }
    }
  }
  return null;
}

interface ImageDropzoneProps {
  /** Current image URL, or "" for none. */
  value: string;
  onChange: (url: string) => void;
  /** Tags the stored file so uploads can be traced back to a feature. */
  purpose: string;
  label?: string;
  description?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Drop an image here, or click to pick one.
 *
 * Uploads immediately and hands back the stored URL — the caller keeps the URL
 * in its own form state, so nothing is written until the surrounding form is
 * saved. Removing clears the URL locally for the same reason: the file stays in
 * the bucket until someone actually saves, which is what makes an accidental
 * "Remove" recoverable by cancelling the dialog.
 */
export function ImageDropzone({
  value,
  onChange,
  purpose,
  label,
  description,
  disabled = false,
  className,
}: ImageDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const upload = useCallback(
    async (file: File) => {
      if (!isAcceptedImage(file)) {
        toast.error(
          "That file type is not supported. Use a JPEG, PNG, WebP, GIF or HEIC image.",
        );
        return;
      }
      try {
        setUploading(true);
        const uploaded = await uploadFile(file, { bucket: "uploads", purpose });
        onChange(uploaded.url);
      } catch (err) {
        toast.error(
          err instanceof ApiError || err instanceof Error
            ? err.message
            : "Image upload failed",
        );
      } finally {
        setUploading(false);
        // Clear the input so choosing the SAME file again still fires change.
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [onChange, purpose],
  );

  const busy = uploading || disabled;

  return (
    <div className={cn("flex items-start gap-3", className)}>
      <div
        role="button"
        tabIndex={busy ? -1 : 0}
        aria-label={
          value ? "Replace image — drop a file or click" : "Upload an image"
        }
        aria-busy={uploading}
        onClick={() => {
          if (!busy) inputRef.current?.click();
        }}
        onKeyDown={(e) => {
          if (busy) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!busy) setDragOver(true);
        }}
        onDragOver={(e) => {
          // Without preventDefault the browser navigates to the dropped file
          // instead of letting the page handle it.
          e.preventDefault();
          e.stopPropagation();
          if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
          if (!busy) setDragOver(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOver(false);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOver(false);
          if (busy) return;
          const file = firstFileFrom(e.dataTransfer);
          if (!file) {
            toast.error("Could not read the dropped file");
            return;
          }
          void upload(file);
        }}
        className={cn(
          `
            relative flex size-24 shrink-0 cursor-pointer items-center
            justify-center overflow-hidden rounded-md border border-dashed
            transition-colors
          `,
          dragOver
            ? "border-primary bg-primary/10"
            : "border-border bg-muted/40 hover:border-primary/60",
          busy && "cursor-not-allowed opacity-70",
        )}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={value}
            alt="Uploaded preview"
            className="size-full object-cover"
          />
        ) : (
          <ImageIcon className="text-muted-foreground size-5" />
        )}
        {uploading && (
          <div
            className={`
              bg-background/70 absolute inset-0 flex items-center justify-center
            `}
          >
            <Loader2 className="size-5 animate-spin" />
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        {label && <p className="text-sm font-medium">{label}</p>}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_ATTR}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
          }}
        />
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="mr-1.5 size-3.5 animate-spin" />
            ) : (
              <Upload className="mr-1.5 size-3.5" />
            )}
            {value ? "Replace" : "Upload"}
          </Button>
          {value && !uploading && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-destructive"
              disabled={disabled}
              onClick={() => onChange("")}
            >
              <X className="mr-1 size-3.5" />
              Remove
            </Button>
          )}
        </div>
        <p className="text-muted-foreground text-xs">
          {description ?? "Drag an image here, or click to choose one."}
        </p>
      </div>
    </div>
  );
}
