/**
 * Static metadata for every model the copilot exposes to the frontend.
 * The auto-router reads `pricePerKToken` to bias toward cheaper models
 * when the heuristic is otherwise indifferent. The frontend reads
 * `family` and `tier` to render badges in the model picker.
 */

export type ModelFamily =
  | 'gemini'
  | 'claude'
  | 'gpt'
  | 'llama'
  | 'mistral'
  | 'deepseek'
  | 'perplexity'
  | 'cloudflare'
  | 'morph'
  | 'fal'
  | 'other';

export type ModelTier = 'fast' | 'balanced' | 'max';

export interface ModelMetadata {
  family: ModelFamily;
  tier: ModelTier;
  /** USD per 1k input tokens, rough mid-2025 list price. Used for cost-aware routing. */
  pricePerKToken: number;
}

const FALLBACK_METADATA: ModelMetadata = {
  family: 'other',
  tier: 'balanced',
  pricePerKToken: 0,
};

/**
 * Lookup table keyed by model id. Keep in sync with the provider model
 * lists. Prices are USD/1k input tokens; output tokens cost ~3-5x more
 * but for routing cost-awareness the input figure is sufficient.
 */
const METADATA: Record<string, ModelMetadata> = {
  // Gemini
  'gemini-2.5-flash': {
    family: 'gemini',
    tier: 'fast',
    pricePerKToken: 0.000075,
  },
  'gemini-2.5-pro': { family: 'gemini', tier: 'max', pricePerKToken: 0.00125 },
  'gemini-3.1-pro-preview': {
    family: 'gemini',
    tier: 'max',
    pricePerKToken: 0.00125,
  },
  'gemini-3.1-flash-lite-preview': {
    family: 'gemini',
    tier: 'fast',
    pricePerKToken: 0.0001,
  },
  'gemini-embedding-001': {
    family: 'gemini',
    tier: 'fast',
    pricePerKToken: 0.00002,
  },

  // Claude
  'claude-opus-4@20250514': {
    family: 'claude',
    tier: 'max',
    pricePerKToken: 0.015,
  },
  'claude-opus-4-20250514': {
    family: 'claude',
    tier: 'max',
    pricePerKToken: 0.015,
  },
  'claude-sonnet-4-5@20250929': {
    family: 'claude',
    tier: 'balanced',
    pricePerKToken: 0.003,
  },
  'claude-sonnet-4-5-20250929': {
    family: 'claude',
    tier: 'balanced',
    pricePerKToken: 0.003,
  },
  'claude-sonnet-4@20250514': {
    family: 'claude',
    tier: 'balanced',
    pricePerKToken: 0.003,
  },
  'claude-sonnet-4-20250514': {
    family: 'claude',
    tier: 'balanced',
    pricePerKToken: 0.003,
  },

  // GPT
  'gpt-5': { family: 'gpt', tier: 'max', pricePerKToken: 0.005 },
  'gpt-5-2025-08-07': { family: 'gpt', tier: 'max', pricePerKToken: 0.005 },
  'gpt-5.2': { family: 'gpt', tier: 'max', pricePerKToken: 0.005 },
  'gpt-5.2-2025-12-11': { family: 'gpt', tier: 'max', pricePerKToken: 0.005 },
  'gpt-5-mini': { family: 'gpt', tier: 'balanced', pricePerKToken: 0.0005 },
  'gpt-5-nano': { family: 'gpt', tier: 'fast', pricePerKToken: 0.00015 },
  'gpt-4o': { family: 'gpt', tier: 'balanced', pricePerKToken: 0.0025 },
  'gpt-4o-mini': { family: 'gpt', tier: 'fast', pricePerKToken: 0.00015 },
  'gpt-4.1': { family: 'gpt', tier: 'balanced', pricePerKToken: 0.002 },
  'gpt-4.1-mini': { family: 'gpt', tier: 'fast', pricePerKToken: 0.0004 },
  'gpt-4.1-nano': { family: 'gpt', tier: 'fast', pricePerKToken: 0.0001 },
  o1: { family: 'gpt', tier: 'max', pricePerKToken: 0.015 },
  o3: { family: 'gpt', tier: 'max', pricePerKToken: 0.01 },
  'o4-mini': { family: 'gpt', tier: 'balanced', pricePerKToken: 0.001 },

  // Llama (Vertex MaaS)
  'llama-3.1-70b-instruct-maas': {
    family: 'llama',
    tier: 'balanced',
    pricePerKToken: 0.00072,
  },
  'llama-3.1-405b-instruct-maas': {
    family: 'llama',
    tier: 'max',
    pricePerKToken: 0.005,
  },
  'llama-4-scout-17b-16e-instruct-maas': {
    family: 'llama',
    tier: 'fast',
    pricePerKToken: 0.00025,
  },
  'llama-4-maverick-17b-128e-instruct-maas': {
    family: 'llama',
    tier: 'balanced',
    pricePerKToken: 0.00035,
  },

  // Mistral (Vertex MaaS)
  'mistral-large-2411': {
    family: 'mistral',
    tier: 'max',
    pricePerKToken: 0.002,
  },
  'codestral-2501': {
    family: 'mistral',
    tier: 'balanced',
    pricePerKToken: 0.0003,
  },

  // DeepSeek (Vertex MaaS)
  'deepseek-r1-0528-maas': {
    family: 'deepseek',
    tier: 'max',
    pricePerKToken: 0.00055,
  },
};

export function getModelMetadata(modelId: string): ModelMetadata {
  return METADATA[modelId] ?? FALLBACK_METADATA;
}

/**
 * Optional override map exposed for tests / future plugin architectures.
 * Mutating the export is discouraged in production code paths.
 */
export const MODEL_METADATA = METADATA;
