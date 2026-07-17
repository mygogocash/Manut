"use client";

import "react-quill-new/dist/quill.snow.css";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";

const ReactQuill = dynamic(() => import("react-quill-new"), {
  ssr: false,
  loading: () => (
    <div className="space-y-2">
      <Skeleton className="h-9 w-full rounded-md" />
      <Skeleton className="h-[180px] w-full rounded-md" />
    </div>
  ),
});

const modules = {
  toolbar: [
    ["bold", "italic", "underline", "strike"],
    [{ color: [] }, { background: [] }],
    [{ size: ["small", false, "large", "huge"] }],
    ["link", "image"],
    ["clean"],
  ],
};

const formats = [
  "bold",
  "italic",
  "underline",
  "strike",
  "color",
  "background",
  "size",
  "link",
  "image",
];

interface GmailRichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function GmailRichTextEditor({
  value,
  onChange,
  disabled,
}: GmailRichTextEditorProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-9 w-full rounded-md" />
        <Skeleton className="h-[180px] w-full rounded-md" />
      </div>
    );
  }

  return (
    <>
      <style>{`
        .gmail-quill .ql-toolbar {
          border-color: hsl(var(--border)) !important;
          border-radius: 0.375rem 0.375rem 0 0;
          background: hsl(var(--muted));
        }
        .gmail-quill .ql-container {
          border-color: hsl(var(--border)) !important;
          border-radius: 0 0 0.375rem 0.375rem;
          font-size: 0.875rem;
          min-height: 140px;
        }
        .gmail-quill .ql-editor {
          min-height: 140px;
          color: hsl(var(--foreground));
        }
        .gmail-quill .ql-editor.ql-blank::before {
          color: hsl(var(--muted-foreground));
          font-style: normal;
        }
        .gmail-quill .ql-stroke {
          stroke: hsl(var(--muted-foreground)) !important;
        }
        .gmail-quill .ql-fill {
          fill: hsl(var(--muted-foreground)) !important;
        }
        .gmail-quill .ql-picker-label {
          color: hsl(var(--muted-foreground)) !important;
        }
        .gmail-quill .ql-picker-options,
        .gmail-quill .ql-tooltip {
          z-index: 300 !important;
          background: hsl(var(--popover)) !important;
          border-color: hsl(var(--border)) !important;
          color: hsl(var(--popover-foreground)) !important;
        }
        .gmail-quill .ql-active .ql-stroke {
          stroke: hsl(var(--primary)) !important;
        }
        .gmail-quill .ql-active .ql-fill {
          fill: hsl(var(--primary)) !important;
        }
      `}</style>
      <div className="gmail-quill">
        <ReactQuill
          theme="snow"
          value={value}
          onChange={onChange}
          modules={modules}
          formats={formats}
          placeholder="Write your message…"
          readOnly={disabled}
        />
      </div>
    </>
  );
}
