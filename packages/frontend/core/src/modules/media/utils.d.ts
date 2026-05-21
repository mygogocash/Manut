import type { AttachmentBlockModel } from '@blocksuite/affine/model';
export declare function getAttachmentType(model: AttachmentBlockModel): "image" | "video" | "unknown" | "audio" | "pdf";
export declare function downloadBlobToBuffer(model: AttachmentBlockModel): Promise<any>;
//# sourceMappingURL=utils.d.ts.map