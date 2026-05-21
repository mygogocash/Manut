import { Store } from '@toeverything/infra';
import type { WorkspaceDBService } from '../../db';
import type { DocIntegrationRef } from '../../db/schema/schema';
import type { DocsService } from '../../doc';
export declare class IntegrationRefStore extends Store {
    private readonly dbService;
    private readonly docsService;
    constructor(dbService: WorkspaceDBService, docsService: DocsService);
    get userDB(): import("@toeverything/infra").TableMap<{
        readonly favorite: {
            readonly key: import("@toeverything/infra").FieldSchemaBuilder<string, false, true>;
            readonly index: import("@toeverything/infra").FieldSchemaBuilder<string, false, false>;
        };
        readonly settings: {
            readonly key: import("@toeverything/infra").FieldSchemaBuilder<string, false, true>;
            readonly value: import("@toeverything/infra").FieldSchemaBuilder<any, false, false>;
        };
        readonly docIntegrationRef: {
            readonly id: import("@toeverything/infra").FieldSchemaBuilder<string, false, true>;
            readonly type: import("@toeverything/infra").FieldSchemaBuilder<"readwise", false, false>;
            readonly integrationId: import("@toeverything/infra").FieldSchemaBuilder<string, false, false>;
            readonly refMeta: import("@toeverything/infra").FieldSchemaBuilder<any, false, false>;
        };
    }>;
    get allDocsMap(): Map<string, import("../../doc").DocRecord>;
    getRefs(where: Parameters<typeof this.userDB.docIntegrationRef.find>[0]): {
        id: string;
        type: "readwise";
        refMeta: any;
        integrationId: string;
    }[];
    createRef(docId: string, config: Omit<DocIntegrationRef, 'id'>): {
        id: string;
        type: "readwise";
        refMeta: any;
        integrationId: string;
    };
    updateRef(docId: string, config: Partial<DocIntegrationRef>): {
        id: string;
        type: "readwise";
        refMeta: any;
        integrationId: string;
    } | null;
    deleteRef(docId: string): void;
}
//# sourceMappingURL=integration-ref.d.ts.map