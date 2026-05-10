import {
  ViewBody,
  ViewHeader,
  ViewIcon,
  ViewTitle,
} from '@affine/core/modules/workbench';
import { TodayIcon } from '@blocksuite/icons/rc';

import { Header } from '../../../../components/pure/header';
import { AllDocSidebarTabs } from '../layouts/all-doc-sidebar-tabs';

const RemindersHeader = () => (
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
        <TodayIcon /> Reminders
      </span>
    }
  />
);

const RemindersPage = () => (
  <>
    <ViewTitle title="Reminders" />
    <ViewIcon icon="allDocs" />
    <ViewHeader>
      <RemindersHeader />
    </ViewHeader>
    <ViewBody>
      <p style={{ padding: 16, opacity: 0.8 }}>
        Scheduled reminders and automation will appear here. Email delivery can
        use Resend when <code>MAIL_PROVIDER=resend</code> is set on the server.
      </p>
    </ViewBody>
    <AllDocSidebarTabs />
  </>
);

export const Component = () => <RemindersPage />;
