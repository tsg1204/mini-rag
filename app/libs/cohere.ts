/**
 * COHERE CLIENT CONFIGURATION
 *
 * KEY CONCEPTS:
 *
 * 1. RE-RANKING:
 *    - Re-ranking improves search quality by re-scoring initial results
 *    - First retrieve a larger set of candidates (e.g., top 50)
 *    - Then use Cohere's rerank model to identify the most relevant ones
 *    - More accurate than vector similarity alone
 *
 * 2. COHERE RERANK MODELS:
 *    - rerank-english-v3.0: Best for English content, supports up to 4096 tokens
 *    - rerank-multilingual-v3.0: Supports 100+ languages
 *    - rerank-v2.0: Legacy model, still effective
 *
 * Learn more: https://docs.cohere.com/docs/reranking
 */

import { CohereClient } from 'cohere-ai';

const token = process.env.COHERE_RERANK_API?.trim();

export const cohereClient: CohereClient | null = token
  ? new CohereClient({ token })
  : null;
