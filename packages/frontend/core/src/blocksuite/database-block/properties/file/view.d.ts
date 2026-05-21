import { PeekViewService } from '@affine/core/modules/peek-view/services/peek-view';
import { type CellRenderProps } from '@blocksuite/affine/blocks/database';
import type { BlobEngine } from '@blocksuite/affine/sync';
import { type ReadonlySignal } from '@preact/signals-core';
import { type FileTypeResult } from 'file-type';
import type { MouseEvent } from 'react';
import type { FileCellJsonValueType, FileCellRawValueType, FileItemType } from './define';
interface FileUploadProgress {
    name: string;
    progress: number;
}
interface FileLoadData {
    blob: Blob;
    url: string;
    fileType?: FileTypeResult;
}
declare class FileUploadManager {
    private readonly blobSync;
    private readonly uploadProgressMap;
    private readonly fileLoadMap;
    constructor(blobSync: BlobEngine);
    uploadFile(file: File, onComplete: (blobId?: string) => void): string;
    startUpload(file: File, fileId: string): Promise<string | undefined>;
    getUploadProgress(fileId: string): ReadonlySignal<FileUploadProgress> | undefined;
    getFileBlob(blobId: string): Promise<Blob | null>;
    getFileInfo(blobId: string): ReadonlySignal<FileLoadData | undefined>;
    private simulateUploadProgress;
    dispose(): void;
}
type FileItemDoneType = FileItemType & {
    type: 'done';
};
type FileItemUploadingType = {
    id: string;
    type: 'uploading';
    name: string;
    order: string;
};
type FileItemRenderType = FileItemDoneType | FileItemUploadingType;
declare class FileCellManager {
    private readonly peekViewService;
    private readonly cell;
    readonly selectCurrentCell: (editing: boolean) => void;
    private readonly blobSync?;
    private readonly uploadingFiles;
    readonly isEditing: ReadonlySignal<boolean>;
    readonly fileUploadManager: FileUploadManager | undefined;
    doneFiles: ReadonlySignal<Record<string, {
        id: string;
        order: string;
        name: string;
        mime?: string | undefined;
    }>>;
    get readonly(): ReadonlySignal<boolean>;
    constructor(props: CellRenderProps<{}, FileCellRawValueType, FileCellJsonValueType>, peekViewService: PeekViewService);
    dispose(): void;
    removeFile: (file: FileItemRenderType, e?: MouseEvent) => void;
    uploadFile: (file: File) => void;
    fileList: ReadonlySignal<(FileItemDoneType | FileItemUploadingType)[]>;
    openPreview: (id: string) => void;
}
export declare const FileListItem: (props: {
    file: FileItemRenderType;
    handleRemoveFile: (file: FileItemRenderType, e?: MouseEvent) => void;
    manager: FileCellManager;
}) => import("react/jsx-runtime").JSX.Element;
export declare const filePropertyConfig: import("@blocksuite/data-view").PropertyMetaConfig<"attachment", {}, Record<string, {
    id: string;
    order: string;
    name: string;
    mime?: string | undefined;
}>, string[]>;
export {};
//# sourceMappingURL=view.d.ts.map