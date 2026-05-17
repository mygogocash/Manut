export type WorkspaceMetadata = {
  id: string;
  flavour: string;
  initialized?: boolean;
  /** Server- or client-derived URL segment for /workspace/:key/... */
  slug?: string;
};
