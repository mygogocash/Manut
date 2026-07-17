"use client";

import { format, parseISO } from "date-fns";
import { Calendar, Edit, ExternalLink, Trash2, User } from "lucide-react";
import Image from "next/image";

import { UpdatePRDialog } from "@/components/articles/update-pr-dialog";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type Article } from "@/services/article.service";

interface PRCardProps {
  article: Article;
  canEdit?: boolean;
  canDelete?: boolean;
  onDeletePR?: (id: string) => void;
  onPRUpdated?: (article: Article) => void;
}

function safeArticleDate(dateStr: string) {
  try {
    const d = parseISO(`${dateStr}T12:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

export function PRCard({
  article,
  canEdit = true,
  canDelete = true,
  onDeletePR,
  onPRUpdated,
}: PRCardProps) {
  const displayDate = safeArticleDate(article.date);
  const hasActions = canEdit || canDelete;

  return (
    <div
      className={`
        group bg-card relative flex flex-col overflow-hidden rounded-xl border
        shadow-sm transition-all duration-300
        hover:-translate-y-0.5 hover:shadow-md
      `}
    >
      {/* Cover image */}
      <div className="relative aspect-video overflow-hidden">
        <Image
          src={article.img}
          alt={article.title}
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          fill
          className={`
            object-cover transition-transform duration-500 ease-out
            group-hover:scale-105
          `}
          unoptimized
        />
        <div
          className={`
            absolute inset-0 bg-linear-to-t from-black/50 via-black/10
            to-transparent opacity-60 transition-opacity duration-300
            group-hover:opacity-40
          `}
        />

        {/* Type badge */}
        <div className="absolute top-3 left-3">
          <Badge
            className={`bg-sky-500/90 text-white shadow-sm backdrop-blur-sm`}
          >
            PR Article
          </Badge>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <h3
          className={`
            line-clamp-2 text-[0.9375rem] leading-snug font-semibold
            tracking-tight
          `}
          title={article.title}
        >
          {article.title}
        </h3>

        {/* External link */}
        <a
          href={article.link}
          target="_blank"
          rel="noopener noreferrer"
          className={`
            text-muted-foreground inline-flex items-center gap-1.5 text-xs
            transition-colors
            hover:text-primary
          `}
        >
          <ExternalLink className="size-3 shrink-0" />
          <span className="truncate">{article.link}</span>
        </a>

        {/* Meta row */}
        <div
          className={`
            mt-auto flex items-center gap-3 border-t border-dashed pt-3 text-xs
          `}
        >
          <span
            className={`
              text-muted-foreground inline-flex items-center gap-1 truncate
            `}
          >
            <User className="size-3 shrink-0" />
            <span className="truncate">{article.author.name}</span>
          </span>
          <span
            className={`
              text-muted-foreground ml-auto inline-flex shrink-0 items-center
              gap-1
            `}
          >
            <Calendar className="size-3" />
            {displayDate ? format(displayDate, "MMM d, yyyy") : article.date}
          </span>
        </div>
      </div>

      {/* Actions */}
      {hasActions && (
        <div className="flex items-center gap-2 border-t px-4 py-3">
          {canDelete && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`
                    text-muted-foreground gap-1.5
                    hover:text-destructive hover:bg-destructive/10
                  `}
                >
                  <Trash2 className="size-3.5" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this PR article?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. The article &ldquo;
                    {article.title}&rdquo; will be permanently removed.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className={`
                      bg-destructive text-destructive-foreground
                      hover:bg-destructive/90
                    `}
                    onClick={() => onDeletePR?.(article.id)}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {canEdit && (
            <UpdatePRDialog
              article={article}
              onPRUpdated={onPRUpdated}
              trigger={
                <Button variant="outline" size="sm" className="ml-auto gap-1.5">
                  <Edit className="size-3.5" />
                  Edit
                </Button>
              }
            />
          )}
        </div>
      )}
    </div>
  );
}
