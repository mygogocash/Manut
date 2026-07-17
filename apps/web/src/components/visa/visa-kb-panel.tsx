"use client";

import { BookOpen, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/components/shared/badge";
import { RichTextViewer } from "@/components/shared/rich-text-editor";
import {
  getVisaArticlesForRecord,
  type VisaKbArticle,
} from "@/services/visa-kb.service";

export function VisaKbPanel({
  country,
  visaType,
}: {
  country?: string;
  visaType?: string;
}) {
  const [articles, setArticles] = useState<VisaKbArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getVisaArticlesForRecord(country, visaType)
      .then((res) => {
        if (cancelled) return;
        setArticles(res.data);
        // Auto-expand the single most relevant article.
        if (res.data.length === 1) setOpenId(res.data[0].id);
      })
      .catch(() => {
        if (!cancelled) setArticles([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [country, visaType]);

  if (!loading && articles.length === 0) return null;

  return (
    <div className="border-border/60 rounded-md border p-3">
      <div
        className={`
          text-foreground mb-2 flex items-center gap-2 text-sm font-semibold
        `}
      >
        <BookOpen className="size-4" />
        Guidance
      </div>
      {loading ? (
        <div className="flex h-12 items-center justify-center">
          <Loader2 className="text-muted-foreground size-4 animate-spin" />
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {articles.map((a) => {
            const isOpen = openId === a.id;
            return (
              <div key={a.id} className="border-border/60 rounded-md border">
                <button
                  type="button"
                  onClick={() => setOpenId(isOpen ? null : a.id)}
                  className={`
                    hover:bg-muted/40
                    flex w-full items-center gap-2 px-2.5 py-2 text-left
                  `}
                >
                  {isOpen ? (
                    <ChevronDown
                      className={`text-muted-foreground size-3.5 shrink-0`}
                    />
                  ) : (
                    <ChevronRight
                      className={`text-muted-foreground size-3.5 shrink-0`}
                    />
                  )}
                  <span className="text-foreground flex-1 text-sm font-medium">
                    {a.title}
                  </span>
                  {a.country ? (
                    <Badge variant="grey" className="text-[10px]">
                      {a.country}
                    </Badge>
                  ) : null}
                </button>
                {isOpen ? (
                  <div className="border-border/60 border-t px-3 py-2">
                    <RichTextViewer html={a.body} />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
