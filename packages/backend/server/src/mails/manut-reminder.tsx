import { TEST_WORKSPACE } from './common';
import {
  Content,
  P,
  Template,
  Title,
  Workspace,
  type WorkspaceProps,
} from './components';

export type ManutReminderProps = {
  title: string;
  body?: string;
  workspace: WorkspaceProps;
};

export default function ManutReminder(props: ManutReminderProps) {
  return (
    <Template>
      <Title>{props.title}</Title>
      <Content>
        <P>
          Reminder from <Workspace {...props.workspace} />
        </P>
        {props.body ? <P>{props.body}</P> : null}
      </Content>
    </Template>
  );
}

ManutReminder.PreviewProps = {
  title: 'Follow up with Acme',
  body: 'Review the proposal and send the next-step note.',
  workspace: TEST_WORKSPACE,
};
