export interface ProviderInfo {
  name: string;
  displayName: string;
  description: string;
  icon?: string;
}

export interface ConnectedAccount {
  id: string;
  provider: string;
  displayName: string;
  scopes: string[];
  createdAt: string;
}
