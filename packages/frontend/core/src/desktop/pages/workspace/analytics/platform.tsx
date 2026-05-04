import { PlatformPage } from '@affine/core/modules/analytics/views/platform-page';
import {
  ViewBody,
  ViewHeader,
  ViewIcon,
  ViewTitle,
} from '@affine/core/modules/workbench';
import { DataPanelIcon } from '@blocksuite/icons/rc';
import { useParams } from 'react-router-dom';

import { Header } from '../../../../components/pure/header';
import { AllDocSidebarTabs } from '../layouts/all-doc-sidebar-tabs';

const AnalyticsPlatformHeader = ({ platform }: { platform: string }) => {
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
          <DataPanelIcon /> Analytics · {platform.toUpperCase()}
        </span>
      }
    />
  );
};

const AnalyticsPlatformRoute = () => {
  const { platform } = useParams<{ platform: string }>();
  const platformSlug = platform ?? 'unknown';
  return (
    <>
      <ViewTitle title={`Analytics · ${platformSlug}`} />
      <ViewIcon icon="allDocs" />
      <ViewHeader>
        <AnalyticsPlatformHeader platform={platformSlug} />
      </ViewHeader>
      <ViewBody>
        <PlatformPage platform={platformSlug} />
      </ViewBody>
      <AllDocSidebarTabs />
    </>
  );
};

export const Component = () => {
  return <AnalyticsPlatformRoute />;
};
