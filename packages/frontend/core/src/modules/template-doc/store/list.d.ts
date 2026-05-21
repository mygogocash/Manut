import { Store } from '@toeverything/infra';
import type { WorkspaceDBService } from '../../db';
export declare class TemplateDocListStore extends Store {
    private readonly dbService;
    constructor(dbService: WorkspaceDBService);
    isTemplateDoc(docId: string): boolean;
    watchTemplateDoc(docId: string): import("rxjs").Observable<boolean | null | undefined>;
    getTemplateDocIds(): string[];
    watchTemplateDocs(): import("rxjs").Observable<{
        [x: string]: any;
        id: string;
        primaryMode?: string | null | undefined;
        edgelessColorTheme?: string | null | undefined;
        journal?: string | null | undefined;
        pageWidth?: string | null | undefined;
        isTemplate?: boolean | null | undefined;
        integrationType?: "readwise" | null | undefined;
        createdBy?: string | null | undefined;
        updatedBy?: string | null | undefined;
    }[]>;
}
//# sourceMappingURL=list.d.ts.map