import { IconButton } from '@affine/component';
import { AttachmentIcon, CloseIcon } from '@blocksuite/icons/rc';
import {
  type ChangeEvent,
  type DragEvent,
  type FC,
  useCallback,
  useRef,
  useState,
} from 'react';

import * as styles from './files.css';

export interface AgentFile {
  id: string;
  name: string;
  size?: number;
}

export interface FilesSectionProps {
  files: AgentFile[];
  onAdd: (files: File[]) => void;
  onRemove: (fileId: string) => void;
  disabled?: boolean;
}

function formatBytes(bytes?: number): string | null {
  if (bytes === undefined || bytes === null) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const FilesSection: FC<FilesSectionProps> = ({
  files,
  onAdd,
  onRemove,
  disabled,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClickDropzone = useCallback(() => {
    if (disabled) return;
    inputRef.current?.click();
  }, [disabled]);

  const handleInputChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const list = e.target.files;
      if (!list || list.length === 0) return;
      onAdd(Array.from(list));
      // Reset so re-selecting the same file fires onChange again.
      e.target.value = '';
    },
    [onAdd]
  );

  const handleDragOver = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      if (disabled) return;
      e.preventDefault();
      setIsDragging(true);
    },
    [disabled]
  );

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      if (disabled) return;
      e.preventDefault();
      setIsDragging(false);
      const dropped = Array.from(e.dataTransfer.files ?? []);
      if (dropped.length > 0) {
        onAdd(dropped);
      }
    },
    [disabled, onAdd]
  );

  return (
    <section className={styles.section} aria-labelledby="agent-files-heading">
      <div className={styles.sectionHeader}>
        <span className={styles.sectionIcon} aria-hidden="true">
          <AttachmentIcon />
        </span>
        <h3 id="agent-files-heading" className={styles.sectionTitle}>
          Files
        </h3>
      </div>
      <p className={styles.sectionDescription}>
        Add reference docs, data, or files that Computer should use as context.
      </p>

      <div
        className={styles.dropzone}
        data-dragging={isDragging}
        onClick={handleClickDropzone}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        role="button"
        tabIndex={0}
        aria-label="Upload files"
      >
        Drag and drop files here, or click to browse
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        className={styles.dropzoneHidden}
        onChange={handleInputChange}
        disabled={disabled}
      />

      {files.length > 0 ? (
        <ul className={styles.fileList}>
          {files.map(file => {
            const sizeLabel = formatBytes(file.size);
            return (
              <li key={file.id} className={styles.fileItem}>
                <span className={styles.fileItemIcon} aria-hidden="true">
                  <AttachmentIcon />
                </span>
                <span className={styles.fileItemName}>{file.name}</span>
                {sizeLabel ? (
                  <span className={styles.fileItemSize}>{sizeLabel}</span>
                ) : null}
                <IconButton
                  size="20"
                  icon={<CloseIcon />}
                  onClick={() => onRemove(file.id)}
                  disabled={disabled}
                  aria-label={`Remove ${file.name}`}
                />
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
};
