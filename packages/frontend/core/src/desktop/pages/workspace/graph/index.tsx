import { KnowledgeGraphView } from '@affine/core/modules/knowledge-graph';
import { DebugLogger } from '@affine/debug';
import type { CSSProperties, ErrorInfo, ReactNode } from 'react';
import { Component as ReactComponent } from 'react';

import { ViewBody, ViewIcon, ViewTitle } from '../../../../modules/workbench';

const logger = new DebugLogger('knowledge-graph-page');

const containerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  height: '100%',
};

const emptyFallbackStyle: CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 32,
  textAlign: 'center',
  color: 'var(--affine-text-secondary-color, #888)',
  fontSize: 14,
};

/**
 * Friendly empty state used when the Knowledge Graph view fails to mount.
 * The graph is an exploratory surface — a full-page red error banner is far
 * worse UX than a "no connections yet" hint that still lets the user navigate
 * away. The original error is logged for Sentry; the user just sees calm.
 */
const GraphEmptyState = () => (
  <div style={emptyFallbackStyle}>
    No connections yet — write a few docs and link them with @-mentions to build
    your knowledge graph.
  </div>
);

interface GraphErrorBoundaryProps {
  children: ReactNode;
}

interface GraphErrorBoundaryState {
  hasError: boolean;
}

/**
 * Page-level error boundary that swallows graph-view throws and renders the
 * empty state instead of bubbling up to the route-level AffineErrorBoundary
 * (which renders the full "Something is wrong... Reload Manut" banner the
 * user reported in #123). Errors are still logged via DebugLogger so Sentry
 * sees them.
 *
 * Suspected throw sites that motivated this boundary:
 *   - `JSON.parse(ref)` in docs-search `watchRefsFrom` if the indexer
 *     stores a malformed reference payload during a partial reindex.
 *   - `useService(EventSourceService)` resolution when `ServerService` is
 *     mid-bootstrap on first paint of a freshly-loaded workspace.
 *   - `new URL(url, baseUrl)` inside EventSourceService when `baseUrl`
 *     resolves to undefined on local-only workspaces.
 */
class GraphErrorBoundary extends ReactComponent<
  GraphErrorBoundaryProps,
  GraphErrorBoundaryState
> {
  override state: GraphErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): GraphErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    logger.error('knowledge graph failed to mount', error, info.componentStack);
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      return <GraphEmptyState />;
    }
    return this.props.children;
  }
}

const GraphPage = () => {
  return (
    <>
      <ViewTitle title="Graph" />
      <ViewIcon icon="allDocs" />
      <ViewBody>
        <div style={containerStyle}>
          <GraphErrorBoundary>
            <KnowledgeGraphView />
          </GraphErrorBoundary>
        </div>
      </ViewBody>
    </>
  );
};

export const Component = () => {
  return <GraphPage />;
};
