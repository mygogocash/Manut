import {
  ViewBody,
  ViewHeader,
  ViewIcon,
  ViewTitle,
} from '@affine/core/modules/workbench';
import { AiOutlineIcon } from '@blocksuite/icons/rc';

import { Header } from '../../../../components/pure/header';
import { AllDocSidebarTabs } from '../layouts/all-doc-sidebar-tabs';
import { AgentsList } from './list';

const AgentsHeader = () => {
  return (
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
          <AiOutlineIcon /> Agents
        </span>
      }
    />
  );
};

const AgentsPage = () => {
  return (
    <>
      <ViewTitle title="Agents" />
      <ViewIcon icon="ai" />
      <ViewHeader>
        <AgentsHeader />
      </ViewHeader>
      <ViewBody>
        <AgentsList />
      </ViewBody>
      <AllDocSidebarTabs />
    </>
  );
};

export const Component = () => {
  return <AgentsPage />;
};
