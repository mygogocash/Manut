"use client";

import { format } from "date-fns";
import { Calendar, Edit, Trash2, User } from "lucide-react";
import Image from "next/image";

import { UpdateBlogDialog } from "@/components/blogs/update-blog-dialog";
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
import { type Blog } from "@/services/blog.service";

interface BlogCardProps {
  blog: Blog;
  canEdit?: boolean;
  canDelete?: boolean;
  onDeleteBlog?: (blogId: string) => void;
  onBlogUpdated?: (blog: Blog) => void;
}

export function BlogCard({
  blog,
  canEdit = true,
  canDelete = true,
  onDeleteBlog,
  onBlogUpdated,
}: BlogCardProps) {
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
          src={blog.coverImage}
          alt={blog.title}
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

        {/* Status badge */}
        <div className="absolute top-3 left-3">
          <Badge
            variant={blog.active ? "default" : "secondary"}
            className={
              blog.active
                ? "bg-emerald-500/90 text-white shadow-sm backdrop-blur-sm"
                : "bg-zinc-800/70 text-zinc-300 shadow-sm backdrop-blur-sm"
            }
          >
            {blog.active ? "Published" : "Draft"}
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
          title={blog.title}
        >
          {blog.title}
        </h3>

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
            <span className="truncate">{blog.author.name}</span>
          </span>
          <span
            className={`
              text-muted-foreground ml-auto inline-flex shrink-0 items-center
              gap-1
            `}
          >
            <Calendar className="size-3" />
            {format(new Date(blog.createdAt), "MMM d, yyyy")}
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
                  <AlertDialogTitle>Delete this blog post?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. The blog post &ldquo;
                    {blog.title}&rdquo; will be permanently removed.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className={`
                      bg-destructive text-destructive-foreground
                      hover:bg-destructive/90
                    `}
                    onClick={() => onDeleteBlog?.(blog.id)}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {canEdit && (
            <UpdateBlogDialog
              blog={blog}
              onBlogUpdated={onBlogUpdated}
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
