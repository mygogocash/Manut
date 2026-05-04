import {
  ViewBody,
  ViewHeader,
  ViewIcon,
  ViewTitle,
} from '@affine/core/modules/workbench';
import { AnalyticsOverview } from '@affine/core/modules/analytics/views/analytics-overview';
import { DataPanelIcon } from '@blocksuite/icons/rc';

import { Header } from '../../../../components/pure/header';
import { AllDocSidebarTabs } from '../layouts/all-doc-sidebar-tabs';

const AnalyticsHeader = () => {
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
          <DataPanelIcon /> Analytics
        </span>
      }
    />
  );
};

const AnalyticsPage = () => {
  return (
    <>
      <ViewTitle title="Analytics" />
      <ViewIcon icon="allDocs" />
      <ViewHeader>
        <AnalyticsHeader />
      </ViewHeader>
      <ViewBody>
        <AnalyticsOverview />
      </ViewBody>
      <AllDocSidebarTabs />
    </>
  );
};

export const Component = () => {
  return <AnalyticsPage />;
};
