import { type Framework } from '@toeverything/infra';
import { QuickSearchService } from './services/quick-search';
import { RecentDocsService } from './services/recent-pages';
export { QuickSearch } from './entities/quick-search';
export { QuickSearchService, RecentDocsService };
export { CollectionsQuickSearchSession } from './impls/collections';
export { CommandsQuickSearchSession } from './impls/commands';
export { CreationQuickSearchSession } from './impls/creation';
export { DocsQuickSearchSession } from './impls/docs';
export { ExternalLinksQuickSearchSession } from './impls/external-links';
export { LinksQuickSearchSession } from './impls/links';
export { RecentDocsQuickSearchSession } from './impls/recent-docs';
export { TagsQuickSearchSession } from './impls/tags';
export { VerbsQuickSearchSession } from './impls/verbs';
export type { QuickSearchItem } from './types/item';
export { QuickSearchContainer } from './views/container';
export { QuickSearchTagIcon } from './views/tag-icon';
export declare function configureQuickSearchModule(framework: Framework): void;
//# sourceMappingURL=index.d.ts.map