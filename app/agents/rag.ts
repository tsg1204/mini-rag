import { AgentRequest, AgentResponse } from './types';
import { openaiClient } from '@/app/libs/openai/openai';
import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';
import { qdrantClient } from '@/app/libs/qdrant';
import { cohereClient } from '@/app/libs/cohere';

function isLikelyRagRelevantQuery(text: string): boolean {
  const q = text.toLowerCase();

  // Strong positive signals (content/LinkedIn/article generation)
  const positiveKeywords = [
    'linkedin',
    'post',
    'tweet',
    'thread',
    'article',
    'blog',
    'newsletter',
    'write ',
    'draft',
    'rewrite',
    'edit ',
    'improve',
    'headline',
    'hook',
    'caption',
    'copy',
  ];

  return positiveKeywords.some((kw) => q.includes(kw));
}

type ScoredPoint = { score: number; payload?: unknown };

function rerankByQdrantScore(
  linkedInPosts: ScoredPoint[],
  articles: ScoredPoint[],
  topN: number,
): string[] {
  const merged = [
    ...linkedInPosts.map((p) => ({ score: p.score, payload: p.payload })),
    ...articles.map((a) => ({ score: a.score, payload: a.payload })),
  ];
  merged.sort((a, b) => b.score - a.score);
  return merged
    .slice(0, topN)
    .map(({ payload }) => {
      const pl = payload as Record<string, unknown> | undefined;
      if (!pl) return undefined;
      return (
        (pl.text as string) || (pl.content as string) || JSON.stringify(pl)
      );
    })
    .filter((t): t is string => typeof t === 'string' && t.trim().length > 0);
}

export async function ragAgent(request: AgentRequest): Promise<AgentResponse> {
  const { query, originalQuery } = request;

  const userText = originalQuery || query || '';

  if (!isLikelyRagRelevantQuery(userText)) {
    // Guardrail: short-circuit obviously irrelevant queries before running expensive RAG
    return streamText({
      model: openai('gpt-5'),
      messages: [
        {
          role: 'system',
          content:
            'You are a polite, firm guardrail. Explain in 2–3 sentences that this agent is specialized in generating and refining LinkedIn posts, social posts, and long-form articles based on a topic, ' +
            'and that the current query appears outside this scope. Invite the user to instead ask for help drafting or improving professional content.',
        },
        {
          role: 'user',
          content: userText,
        },
      ],
    });
  }

  const embedding = await openaiClient.embeddings.create({
    model: 'text-embedding-3-small',
    dimensions: 512,
    input: query,
  });

  const linkedInPosts = await qdrantClient.search('linkedin', {
    vector: embedding.data[0].embedding,
    limit: 10,
    with_payload: true,
  });

  const articles = await qdrantClient.search('articles', {
    vector: embedding.data[0].embedding,
    limit: 10,
    with_payload: true,
  });

  console.log('linkedInPosts', JSON.stringify(linkedInPosts, null, 2));
  console.log('articles', JSON.stringify(articles, null, 2));

  const documents = [
    ...linkedInPosts.map((post) => {
      const payload = post.payload as Record<string, unknown> | undefined;
      if (!payload) return undefined;
      return (
        (payload.text as string) ||
        (payload.content as string) ||
        JSON.stringify(payload)
      );
    }),
    ...articles.map((article) => {
      const payload = article.payload as Record<string, unknown> | undefined;
      if (!payload) return undefined;
      return (
        (payload.text as string) ||
        (payload.content as string) ||
        JSON.stringify(payload)
      );
    }),
  ].filter(
    (doc): doc is string => typeof doc === 'string' && doc.trim().length > 0,
  );

  let contextFromDocuments: string[] = [];

  if (documents.length > 0) {
    const isUnauthorized = (err: unknown) =>
      (err as { statusCode?: number })?.statusCode === 401 ||
      (err as Error)?.name === 'UnauthorizedError';

    if (cohereClient) {
      try {
        const rerankedDocuments = await cohereClient.rerank({
          model: 'rerank-english-v3.0',
          query: query,
          documents,
          topN: 10,
          returnDocuments: true,
        });

        console.log(
          'rerankedDocuments',
          JSON.stringify(rerankedDocuments, null, 2),
        );

        contextFromDocuments = rerankedDocuments.results
          .map((result) => result.document?.text)
          .filter(
            (text): text is string =>
              typeof text === 'string' && text.trim().length > 0,
          );
      } catch (error) {
        if (isUnauthorized(error)) {
          console.warn(
            'RAG agent: Cohere API key missing or invalid (401). Reranking by Qdrant score instead.',
          );
        } else {
          console.error(
            'RAG agent: Cohere rerank failed, reranking by Qdrant score instead.',
            error,
          );
        }
        contextFromDocuments = rerankByQdrantScore(linkedInPosts, articles, 10);
      }
    } else {
      // No Cohere key configured – rerank by Qdrant score instead
      contextFromDocuments = rerankByQdrantScore(linkedInPosts, articles, 10);
    }
  } else {
    console.warn(
      'RAG agent: no valid documents found for reranking, proceeding without retrieved context.',
    );
  }

  // we want to generate a linkedin post based on a user query
  return streamText({
    model: openai('gpt-5'),
    messages: [
      {
        role: 'system',
        content: `
				Generate a LinkedIn post based on a user query.
				Use the style, tone and experiences from these documents to generate the post when available.
				Documents: ${JSON.stringify(contextFromDocuments, null, 2)}
				`,
      },
      {
        role: 'user',
        content: query,
      },
    ],
    temperature: 0.8,
  });

  // TODO: Step 1 - Generate embedding for the refined query
  // Use openaiClient.embeddings.create()
  // Model: 'text-embedding-3-small'
  // Dimensions: 512
  // Input: request.query
  // Extract the embedding from response.data[0].embedding

  // TODO: Step 2 - Query Pinecone for similar documents
  // Get the index: pineconeClient.Index(process.env.PINECONE_INDEX!)
  // Query parameters:
  //   - vector: the embedding from step 1
  //   - topK: 10 (to over-fetch for reranking)
  //   - includeMetadata: true

  // TODO: Step 3 - Extract text from results
  // Map over queryResponse.matches
  // Get metadata?.text (or metadata?.content as fallback)
  // Filter out any null/undefined values

  // TODO: Step 4 - Rerank with Pinecone inference API
  // Use pineconeClient.inference.rerank()
  // Model: 'bge-reranker-v2-m3'
  // Pass the query and documents array
  // This gives you better quality results

  // TODO: Step 5 - Build context from reranked results
  // Map over reranked.data
  // Extract result.document?.text from each
  // Join with '\n\n' separator

  // TODO: Step 6 - Create system prompt
  // Include:
  //   - Instructions to answer based on context
  //   - Original query (request.originalQuery)
  //   - Refined query (request.query)
  //   - The retrieved context
  //   - Instruction to say if context is insufficient

  // TODO: Step 7 - Stream the response
  // Use streamText()
  // Model: openai('gpt-4o')
  // System: your system prompt
  // Messages: request.messages
  // Return the stream

  throw new Error('RAG agent not implemented yet!');
}
