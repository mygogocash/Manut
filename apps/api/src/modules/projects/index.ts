export { default as projectsRoutes } from "@/modules/projects/projects.controller";
// Token-authenticated one-click approval links from workflow emails. Mounted
// outside the `authenticate` guard — the signed token is the credential.
export { default as projectsWorkflowPublicRoutes } from "@/modules/projects/workflow/workflow-public.controller";
