export function pickFirstImage(files: FileList | File[] | null) {
  if (!files || files.length === 0) return { file: null, error: "No file" };
  const f = files[0];

  if (!f.type.startsWith("image/")) {
    return { file: null, error: "File must be an image" };
  }
  if (f.size > 5 * 1024 * 1024) {
    return { file: null, error: "Max size is 5MB" };
  }
  return { file: f, error: null };
}
