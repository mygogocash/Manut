import type { RouteObject } from 'react-router-dom';

export const workbenchRoutes = [
  {
    path: '/chat',
    lazy: () => import('./pages/workspace/chat/index'),
  },
  {
    path: '/all',
    lazy: () => import('./pages/workspace/all-page/all-page'),
  },
  {
    path: '/graph',
    lazy: () => import('./pages/workspace/graph/index'),
  },
  {
    path: '/collection',
    lazy: () => import('./pages/workspace/all-collection'),
  },
  {
    path: '/collection/:collectionId',
    lazy: () => import('./pages/workspace/collection/index'),
  },
  {
    path: '/tag',
    lazy: () => import('./pages/workspace/all-tag'),
  },
  {
    path: '/tag/:tagId',
    lazy: () => import('./pages/workspace/tag'),
  },
  {
    path: '/trash',
    lazy: () => import('./pages/workspace/trash-page'),
  },
  {
    path: '/:pageId',
    lazy: () => import('./pages/workspace/detail-page/detail-page'),
  },
  {
    path: '/:pageId/attachments/:attachmentId',
    lazy: () => import('./pages/workspace/attachment/index'),
  },
  {
    path: '/journals',
    lazy: () => import('./pages/workspace/journals'),
  },
  {
    path: '/agents',
    lazy: () => import('./pages/workspace/agents/index'),
  },
  {
    path: '/agents/:agentId',
    lazy: () => import('./pages/workspace/agents/detail'),
  },
  {
    path: '/analytics',
    lazy: () => import('./pages/workspace/analytics/index'),
  },
  {
    path: '/analytics/:platform',
    lazy: () => import('./pages/workspace/analytics/platform'),
  },
  {
    path: '/projects',
    lazy: () => import('./pages/workspace/projects/index'),
  },
  {
    path: '/projects/:projectId',
    lazy: () => import('./pages/workspace/projects/detail'),
  },
  {
    path: '/crm',
    lazy: () => import('./pages/workspace/crm/index'),
  },
  {
    path: '/reminders',
    lazy: () => import('./pages/workspace/reminders/index'),
  },
  {
    path: '/routines',
    lazy: () => import('./pages/workspace/routines/index'),
  },
  {
    path: '/release-runs',
    lazy: () => import('./pages/workspace/release-runs/index'),
  },
  {
    path: '/release-runs/:runId',
    lazy: () => import('./pages/workspace/release-runs/index'),
  },
  {
    // M17 — CEO Chat. Top-level chat surface that resolves every turn to
    // a typed work object (task / approval / plan / decision). One page
    // per workspace; the conversation list rail handles thread switching.
    path: '/ceo-chat',
    lazy: () => import('./views/manut-ceo-chat/ceo-chat-page'),
  },
  {
    path: '/settings',
    lazy: () => import('./pages/workspace/settings'),
  },
  {
    path: '*',
    lazy: () => import('./pages/404'),
  },
] satisfies RouteObject[];
