import { TEST_WORKSPACE } from './common';
import {
  Content,
  P,
  Template,
  Title,
  Workspace,
  type WorkspaceProps,
} from './components';

export type SuperflowReminderProps = {
  title: string;
  body?: string;
  workspace: WorkspaceProps;
};

export default function SuperflowReminder(props: SuperflowReminderProps) {
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

SuperflowReminder.PreviewProps = {
  title: 'Follow up with Acme',
  body: 'Review the proposal and send the next-step note.',
  workspace: TEST_WORKSPACE,
};
