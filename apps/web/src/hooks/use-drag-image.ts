"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

import { pickFirstImage } from "@/lib/upload-image";

export function useDragImage() {
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const input = e.currentTarget;
      const { file, error } = pickFirstImage(input.files);
      if (error) {
        toast.error(error);
        setAvatarFile(null);
        input.value = "";
        return;
      }
      setAvatarFile(file);
    },
    [],
  );

  const preventDefaults = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const onDragEnter = (e: React.DragEvent) => {
    preventDefaults(e);
    setIsDragging(true);
  };

  const onDragOver = (e: React.DragEvent) => {
    preventDefaults(e);
  };

  const onDragLeave = (e: React.DragEvent) => {
    preventDefaults(e);
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    preventDefaults(e);
    setIsDragging(false);
    const { file, error } = pickFirstImage(e.dataTransfer.files);
    if (error) {
      toast.error(error);
      setAvatarFile(null);
      return;
    }
    setAvatarFile(file);
  };

  const reset = useCallback(() => {
    setAvatarFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  return {
    avatarFile,
    isDragging,
    fileInputRef,
    handleFileChange,
    onDragEnter,
    onDragOver,
    onDragLeave,
    onDrop,
    reset,
  };
}
