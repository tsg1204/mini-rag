import { openaiClient } from '@/app/libs/openai/openai';
import { qdrantClient } from '@/app/libs/qdrant';
import { cohereClient } from '@/app/libs/cohere';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { query, topK } = body; // write an article on x

  // Step 1: Retrieve more candidates than needed for re-ranking
  // We fetch 3x the requested amount to give the re-ranker more options
  const candidateLimit = Math.max(topK * 3, 20); // 5 -> 15

  // Step 2: Generate the embedding for the query
  const embedding = await openaiClient.embeddings.create({
    model: 'text-embedding-3-small',
    dimensions: 512,
    input: query,
  });

  // Step 3: Query qdrant for candidate results
  const candidateResults = await qdrantClient.search('articles', {
    vector: embedding.data[0].embedding,
    limit: candidateLimit,
    with_payload: true,
  });

  // Step 4: Re-rank using Cohere
  // Extract documents (text content) from the results for re-ranking
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const documents = candidateResults.map((result: any) => {
    // Assuming the payload contains a 'text' or 'content' field
    // Adjust this based on your actual payload structure
    const payload = result.payload as Record<string, unknown>;
    return (
      (payload.text as string) ||
      (payload.content as string) ||
      JSON.stringify(payload)
    );
  });

  if (!cohereClient) {
    return NextResponse.json({
      results: candidateResults,
      query: query,
      totalCandidates: candidateResults.length,
      returnedResults: candidateResults.length,
      reranked: false,
      message:
        'Cohere not configured (COHERE_RERANK_API unset). Set it to a valid key to enable reranking.',
    });
  }

  try {
    const rerankedResponse = await cohereClient.rerank({
      model: 'rerank-english-v3.0',
      query,
      documents,
      topN: topK,
      returnDocuments: true,
    });

    const finalResults = rerankedResponse.results.map((result) => ({
      ...candidateResults[result.index],
      relevanceScore: result.relevanceScore,
    }));

    return NextResponse.json({
      results: finalResults,
      query: query,
      totalCandidates: candidateResults.length,
      returnedResults: finalResults.length,
      reranked: true,
    });
  } catch (error) {
    const is401 =
      (error as { statusCode?: number })?.statusCode === 401 ||
      (error as Error)?.name === 'UnauthorizedError';
    if (is401) {
      console.warn(
        'RAG test: Cohere API key invalid (401). Set COHERE_RERANK_API to a valid key.',
      );
    } else {
      console.error('RAG test route: Cohere rerank failed.', error);
    }

    return NextResponse.json({
      results: candidateResults,
      query: query,
      totalCandidates: candidateResults.length,
      returnedResults: candidateResults.length,
      reranked: false,
      error: is401
        ? 'Cohere API key missing or invalid. Set COHERE_RERANK_API to a valid key.'
        : 'Cohere rerank failed; returned original candidates.',
    });
  }
}
