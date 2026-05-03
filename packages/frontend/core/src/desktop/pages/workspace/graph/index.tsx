import { KnowledgeGraphView } from '@affine/core/modules/knowledge-graph';

import { ViewBody, ViewIcon, ViewTitle } from '../../../../modules/workbench';

const GraphPage = () => {
  return (
    <>
      <ViewTitle title="Graph" />
      <ViewIcon icon="allDocs" />
      <ViewBody>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '100%',
            height: '100%',
          }}
        >
          <KnowledgeGraphView />
        </div>
      </ViewBody>
    </>
  );
};

export const Component = () => {
  return <GraphPage />;
};
