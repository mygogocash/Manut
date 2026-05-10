import {
  ViewBody,
  ViewHeader,
  ViewIcon,
  ViewTitle,
} from '@affine/core/modules/workbench';
import { CollaborationIcon } from '@blocksuite/icons/rc';

import { Header } from '../../../../components/pure/header';
import { AllDocSidebarTabs } from '../layouts/all-doc-sidebar-tabs';

const CrmHeader = () => (
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
        <CollaborationIcon /> CRM
      </span>
    }
  />
);

const CrmPage = () => (
  <>
    <ViewTitle title="CRM" />
    <ViewIcon icon="allDocs" />
    <ViewHeader>
      <CrmHeader />
    </ViewHeader>
    <ViewBody>
      <p style={{ padding: 16, opacity: 0.8 }}>
        Accounts, contacts, and deals will be managed here. Backend GraphQL
        operations are available when Superflow is enabled.
      </p>
    </ViewBody>
    <AllDocSidebarTabs />
  </>
);

export const Component = () => <CrmPage />;
