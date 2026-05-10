import {
  ViewBody,
  ViewHeader,
  ViewIcon,
  ViewTitle,
} from '@affine/core/modules/workbench';
import { FolderIcon } from '@blocksuite/icons/rc';

import { Header } from '../../../../components/pure/header';
import { AllDocSidebarTabs } from '../layouts/all-doc-sidebar-tabs';

const ProjectsHeader = () => (
  <Header
    left={
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 14,
          fontWeight: 500,
        }}
      >
        <FolderIcon /> Projects
      </span>
    }
  />
);

const ProjectsPage = () => (
  <>
    <ViewTitle title="Projects" />
    <ViewIcon icon="allDocs" />
    <ViewHeader>
      <ProjectsHeader />
    </ViewHeader>
    <ViewBody>
      <p style={{ padding: 16, opacity: 0.8 }}>
        Superflow project management will appear here. Enable the server with{' '}
        <code>ENABLE_SUPERFLOW_MODULE=true</code> and run migrations to use the
        GraphQL API.
      </p>
    </ViewBody>
    <AllDocSidebarTabs />
  </>
);

export const Component = () => <ProjectsPage />;
