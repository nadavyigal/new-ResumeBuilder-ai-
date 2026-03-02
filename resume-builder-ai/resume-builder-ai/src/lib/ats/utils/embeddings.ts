/**
 * OpenAI Embeddings Client with Caching
 *
 * Provides text embedding functionality using OpenAI's text-embedding-3-small model
 * with in-memory caching to reduce API calls and costs.
 */

import OpenAI from 'openai';
import type { EmbeddingResult, SimilarityResult } from '../types';

/**
 * In-memory cache for embeddings (Map: text hash -> embedding vector)
 * In production, consider using Redis or similar for persistent cache
 */
const embeddingsCache = new Map<string, number[]>();

/**
 * Statistics for cache performance monitoring
 */
let cacheStats = {
  hits: 0,
  misses: 0,
  totalRequests: 0,
};

/**
 * Get OpenAI client instance
 */
function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }

  return new OpenAI({ apiKey });
}

/**
 * Generate a simple hash for cache key
 * (In production, use a proper hashing library like crypto or xxhash)
 */
function hashText(text: string): string {
  // Simple hash for demo - replace with proper hashing in production
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `emb_${Math.abs(hash).toString(36)}`;
}

/**
 * Get embedding for a single text string
 *
 * Uses OpenAI's text-embedding-3-small model (1536 dimensions)
 * Results are cached to reduce API calls
 */
export async function getEmbedding(text: string): Promise<EmbeddingResult> {
  cacheStats.totalRequests++;

  // Normalize text for caching (trim, lowercase for cache key)
  const normalizedText = text.trim();
  if (!normalizedText) {
    throw new Error('Cannot generate embedding for empty text');
  }

  const cacheKey = hashText(normalizedText);

  // Check cache first
  const cached = embeddingsCache.get(cacheKey);
  if (cached) {
    cacheStats.hits++;
    return {
      text: normalizedText,
      vector: cached,
      cached: true,
      cache_key: cacheKey,
    };
  }

  // Cache miss - call OpenAI API
  cacheStats.misses++;

  try {
    const openai = getOpenAIClient();

    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: normalizedText,
      encoding_format: 'float',
    });

    if (!response.data || response.data.length === 0) {
      throw new Error('No embedding returned from OpenAI');
    }

    const vector = response.data[0].embedding;

    // Store in cache
    embeddingsCache.set(cacheKey, vector);

    return {
      text: normalizedText,
      vector,
      cached: false,
      cache_key: cacheKey,
    };
  } catch (error: unknown) {
    const err = error as { message?: string; status?: number };

    if (err.status === 429) {
      throw new Error('OpenAI rate limit exceeded - please try again later');
    }

    if (err.status === 401) {
      throw new Error('Invalid OpenAI API key');
    }

    throw new Error(`Failed to generate embedding: ${err.message || 'Unknown error'}`);
  }
}

/**
 * Get embeddings for multiple text strings in batch
 *
 * OpenAI supports batch embedding requests for efficiency
 */
export async function getBatchEmbeddings(texts: string[]): Promise<EmbeddingResult[]> {
  if (texts.length === 0) {
    return [];
  }

  // Normalize and deduplicate
  const uniqueTexts = [...new Set(texts.map(t => t.trim()))].filter(t => t.length > 0);

  if (uniqueTexts.length === 0) {
    return [];
  }

  // Check cache for each text
  const results: EmbeddingResult[] = [];
  const uncachedTexts: string[] = [];
  const uncachedIndices: number[] = [];

  uniqueTexts.forEach((text, index) => {
    const cacheKey = hashText(text);
    const cached = embeddingsCache.get(cacheKey);

    if (cached) {
      cacheStats.hits++;
      cacheStats.totalRequests++;
      results[index] = {
        text,
        vector: cached,
        cached: true,
        cache_key: cacheKey,
      };
    } else {
      uncachedTexts.push(text);
      uncachedIndices.push(index);
    }
  });

  // Fetch uncached embeddings from API
  if (uncachedTexts.length > 0) {
    cacheStats.misses += uncachedTexts.length;
    cacheStats.totalRequests += uncachedTexts.length;

    try {
      const openai = getOpenAIClient();

      const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: uncachedTexts,
        encoding_format: 'float',
      });

      if (!response.data || response.data.length !== uncachedTexts.length) {
        throw new Error('Incomplete embeddings response from OpenAI');
      }

      // Store results and cache
      response.data.forEach((item, i) => {
        const text = uncachedTexts[i];
        const vector = item.embedding;
        const cacheKey = hashText(text);

        // Cache it
        embeddingsCache.set(cacheKey, vector);

        // Store result at correct index
        const originalIndex = uncachedIndices[i];
        results[originalIndex] = {
          text,
          vector,
          cached: false,
          cache_key: cacheKey,
        };
      });
    } catch (error: unknown) {
      const err = error as { message?: string; status?: number };

      if (err.status === 429) {
        throw new Error('OpenAI rate limit exceeded - please try again later');
      }

      if (err.status === 401) {
        throw new Error('Invalid OpenAI API key');
      }

      throw new Error(`Failed to generate batch embeddings: ${err.message || 'Unknown error'}`);
    }
  }

  return results;
}

/**
 * Calculate cosine similarity between two embedding vectors
 *
 * Returns a value between -1 and 1, where:
 * - 1 = identical
 * - 0 = orthogonal (no similarity)
 * - -1 = opposite
 */
export function cosineSimilarity(vector1: number[], vector2: number[]): number {
  if (vector1.length !== vector2.length) {
    throw new Error('Vectors must have same dimensions');
  }

  if (vector1.length === 0) {
    return 0;
  }

  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;

  for (let i = 0; i < vector1.length; i++) {
    dotProduct += vector1[i] * vector2[i];
    magnitude1 += vector1[i] * vector1[i];
    magnitude2 += vector2[i] * vector2[i];
  }

  magnitude1 = Math.sqrt(magnitude1);
  magnitude2 = Math.sqrt(magnitude2);

  if (magnitude1 === 0 || magnitude2 === 0) {
    return 0;
  }

  return dotProduct / (magnitude1 * magnitude2);
}

/**
 * Calculate semantic similarity between two text strings
 *
 * Returns a SimilarityResult with score from 0-1
 */
export async function calculateSemanticSimilarity(
  text1: string,
  text2: string
): Promise<SimilarityResult> {
  const [emb1, emb2] = await getBatchEmbeddings([text1, text2]);

  const similarity = cosineSimilarity(emb1.vector, emb2.vector);

  // Convert from -1..1 to 0..1 range
  const normalizedScore = (similarity + 1) / 2;

  return {
    score: normalizedScore,
    text1,
    text2,
  };
}

/**
 * Find most similar texts from a list
 *
 * @param query - Query text
 * @param candidates - List of candidate texts to compare
 * @param topK - Number of top results to return (default: 5)
 * @returns Array of {text, score} sorted by similarity (descending)
 */
export async function findMostSimilar(
  query: string,
  candidates: string[],
  topK: number = 5
): Promise<Array<{ text: string; score: number }>> {
  if (candidates.length === 0) {
    return [];
  }

  // Get embeddings for all texts
  const allTexts = [query, ...candidates];
  const embeddings = await getBatchEmbeddings(allTexts);

  const queryEmbedding = embeddings[0];
  const candidateEmbeddings = embeddings.slice(1);

  // Calculate similarities
  const results = candidateEmbeddings.map((emb, index) => ({
    text: candidates[index],
    score: (cosineSimilarity(queryEmbedding.vector, emb.vector) + 1) / 2, // Normalize to 0-1
  }));

  // Sort by score descending and take top K
  results.sort((a, b) => b.score - a.score);

  return results.slice(0, topK);
}

/**
 * Clear the embeddings cache
 * Useful for testing or memory management
 */
export function clearCache(): void {
  embeddingsCache.clear();
  cacheStats = {
    hits: 0,
    misses: 0,
    totalRequests: 0,
  };
}

/**
 * Get cache statistics
 */
export function getCacheStats(): {
  hits: number;
  misses: number;
  totalRequests: number;
  hitRate: number;
  size: number;
} {
  const hitRate = cacheStats.totalRequests > 0
    ? (cacheStats.hits / cacheStats.totalRequests) * 100
    : 0;

  return {
    ...cacheStats,
    hitRate,
    size: embeddingsCache.size,
  };
}

/**
 * Pre-warm cache with common texts
 * Useful for frequently used job descriptions or resume sections
 */
export async function prewarmCache(texts: string[]): Promise<void> {
  await getBatchEmbeddings(texts);
}
