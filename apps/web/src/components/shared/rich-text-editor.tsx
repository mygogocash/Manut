"use client";

import "react-quill-new/dist/quill.snow.css";

import dynamic from "next/dynamic";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { safeHref, URL_PATTERN, URL_TEST } from "@/components/shared/linkify";
import { Skeleton } from "@/components/ui/skeleton";
import { getErrorMessage } from "@/lib/error-message";
import { sanitizeRichHtml } from "@/lib/utils";
import { uploadFile } from "@/services/upload.service";

const ReactQuill = dynamic(() => import("react-quill-new"), {
  ssr: false,
  loading: () => <Skeleton className="h-48 w-full rounded-md" />,
});

// Minimal slice of the Quill editor instance the image handler needs.
// Quill binds `this` to the toolbar module, so `this.quill` is the
// live editor — no React ref forwarding (which is unreliable through
// next/dynamic) required.
interface QuillLike {
  getSelection(focus?: boolean): { index: number } | null;
  getLength(): number;
  insertEmbed(
    index: number,
    type: string,
    value: string,
    source?: string,
  ): void;
  setSelection(index: number, length: number): void;
}

// Replaces Quill's default image button, which embeds the picked file
// as a base64 data URI right in the HTML — a single photo is hundreds of
// KB of text, which blows past any server-side length cap (e.g. the
// partner task description `z.string().max(10000)`) and surfaces as a
// "validation failed" on save, on top of bloating the DB row. Instead we
// upload the file to the public `uploads` bucket and insert its URL, so
// the stored HTML stays tiny. SVG is intentionally excluded (the bucket
// is public — an SVG served from a CDN path is a stored-XSS vector).
function quillImageUploadHandler(this: { quill: QuillLike }): void {
  const quill = this.quill;
  const input = document.createElement("input");
  input.type = "file";
  input.accept =
    "image/png,image/jpeg,image/webp,image/gif,image/heic,image/heif";
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;
    const range = quill.getSelection(true);
    const index = range ? range.index : quill.getLength();
    void uploadFile(file, { bucket: "uploads", purpose: "rich-text-image" })
      .then(({ url }) => {
        quill.insertEmbed(index, "image", url, "user");
        quill.setSelection(index + 1, 0);
      })
      .catch((err: unknown) => {
        toast.error(getErrorMessage(err, "We couldn't upload that image."));
      });
  };
  input.click();
}

const defaultQuillModules = {
  toolbar: {
    container: [
      [{ header: [1, 2, 3, false] }],
      ["bold", "italic", "underline", "strike"],
      [{ color: [] }, { background: [] }],
      [{ list: "ordered" }, { list: "bullet" }],
      [{ indent: "-1" }, { indent: "+1" }],
      [{ align: [] }],
      ["link", "image"],
      ["blockquote", "code-block"],
      ["clean"],
    ],
    handlers: { image: quillImageUploadHandler },
  },
};

const emailQuillModules = {
  toolbar: {
    container: [
      ["bold", "italic", "underline", "strike"],
      [{ color: [] }, { background: [] }],
      [{ size: ["small", false, "large", "huge"] }],
      ["link", "image"],
      ["clean"],
    ],
    handlers: { image: quillImageUploadHandler },
  },
};

const defaultQuillFormats = [
  "header",
  "bold",
  "italic",
  "underline",
  "strike",
  "color",
  "background",
  "list",
  "indent",
  "align",
  "link",
  "image",
  "blockquote",
  "code-block",
];

const emailQuillFormats = [
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

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  readOnly?: boolean;
  /** Compact Outlook-style toolbar for email compose. */
  variant?: "default" | "email";
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Write something...",
  className = "",
  readOnly = false,
  variant = "default",
}: RichTextEditorProps) {
  const modules = variant === "email" ? emailQuillModules : defaultQuillModules;
  const formats = variant === "email" ? emailQuillFormats : defaultQuillFormats;

  return (
    <>
      <style>{`
        .quill-editor .ql-toolbar {
          border-color: hsl(var(--border)) !important;
          border-radius: 0.5rem 0.5rem 0 0;
          background: hsl(var(--muted));
        }
        .quill-editor .ql-container {
          border-color: hsl(var(--border)) !important;
          border-radius: 0 0 0.5rem 0.5rem;
          font-size: 0.8125rem;
          min-height: 120px;
        }
        .quill-editor .ql-editor {
          min-height: 120px;
          color: hsl(var(--foreground));
        }
        .quill-editor .ql-editor.ql-blank::before {
          color: hsl(var(--muted-foreground));
          font-style: normal;
        }
        .quill-editor .ql-stroke {
          stroke: hsl(var(--muted-foreground)) !important;
        }
        .quill-editor .ql-fill {
          fill: hsl(var(--muted-foreground)) !important;
        }
        .quill-editor .ql-picker-label {
          color: hsl(var(--muted-foreground)) !important;
        }
        .quill-editor .ql-picker-options {
          background: hsl(var(--popover)) !important;
          border-color: hsl(var(--border)) !important;
          color: hsl(var(--popover-foreground)) !important;
        }
        .quill-editor .ql-picker-item:hover {
          color: hsl(var(--primary)) !important;
        }
        .quill-editor .ql-active .ql-stroke {
          stroke: hsl(var(--primary)) !important;
        }
        .quill-editor .ql-active .ql-fill {
          fill: hsl(var(--primary)) !important;
        }
        .quill-editor .ql-active {
          color: hsl(var(--primary)) !important;
        }
      `}</style>
      <div
        className={`
          quill-editor
          ${className}
        `}
      >
        <ReactQuill
          theme="snow"
          value={value}
          onChange={onChange}
          modules={modules}
          formats={formats}
          placeholder={placeholder}
          readOnly={readOnly}
        />
      </div>
    </>
  );
}

// Force existing anchors to open in a new tab with a safe rel, and strip
// hrefs that don't resolve to a safe web/mail link.
function hardenAnchors(root: HTMLElement): void {
  root.querySelectorAll("a").forEach((a) => {
    const safe = safeHref(a.getAttribute("href") ?? "");
    if (!safe) {
      a.removeAttribute("href");
      return;
    }
    a.setAttribute("href", safe);
    a.setAttribute("target", "_blank");
    a.setAttribute("rel", "noopener noreferrer nofollow");
  });
}

// Replace bare URLs inside a single text node with anchor elements.
// Building anchors via the DOM (href/textContent set as properties) lets
// the browser encode the values, so a pasted URL can't inject markup.
function linkifyTextNode(textNode: Text): void {
  const text = textNode.nodeValue ?? "";
  const re = new RegExp(URL_PATTERN);
  const frag = document.createDocumentFragment();
  let last = 0;
  let matched = false;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    let raw = m[0];
    // Trailing punctuation usually belongs to the sentence, not the URL.
    const trail = raw.match(/[.,;:!?)\]}'"]+$/);
    const suffix = trail ? trail[0] : "";
    if (suffix) raw = raw.slice(0, -suffix.length);
    const href = safeHref(raw);
    if (!href) continue; // leave the text untouched for the next slice
    matched = true;
    if (m.index > last) {
      frag.appendChild(document.createTextNode(text.slice(last, m.index)));
    }
    const a = document.createElement("a");
    a.href = href;
    a.textContent = raw;
    a.target = "_blank";
    a.rel = "noopener noreferrer nofollow";
    a.className = "text-primary underline underline-offset-2 hover:opacity-80";
    frag.appendChild(a);
    if (suffix) frag.appendChild(document.createTextNode(suffix));
    last = m.index + m[0].length;
  }
  if (!matched) return;
  if (last < text.length) {
    frag.appendChild(document.createTextNode(text.slice(last)));
  }
  textNode.parentNode?.replaceChild(frag, textNode);
}

// Autolink bare URLs in all text nodes except those already inside a
// link or a code block. Idempotent: a URL turned into an <a> on a prior
// run is skipped (it now lives inside an <a>), which matters because the
// effect re-runs on every `html` change and twice under StrictMode.
function linkifyBareUrls(root: HTMLElement): void {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue || !URL_TEST.test(node.nodeValue)) {
        return NodeFilter.FILTER_REJECT;
      }
      for (
        let el = node.parentElement;
        el && el !== root;
        el = el.parentElement
      ) {
        const tag = el.tagName;
        if (tag === "A" || tag === "CODE" || tag === "PRE") {
          return NodeFilter.FILTER_REJECT;
        }
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const targets: Text[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    targets.push(n as Text);
  }
  targets.forEach(linkifyTextNode);
}

export function RichTextViewer({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null);
  // After the HTML is injected, make every link clickable and safe:
  // harden author-created anchors, then autolink any bare URLs typed as
  // plain text (Quill stores those as text, not <a>).
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    hardenAnchors(root);
    linkifyBareUrls(root);
  }, [html]);
  if (!html || html === "<p><br></p>") return null;
  return (
    <div
      ref={ref}
      className={`
        prose prose-sm max-w-none min-w-0 text-[13px] leading-relaxed
        dark:prose-invert
        [overflow-wrap:anywhere]
      `}
      dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(html) }}
    />
  );
}
