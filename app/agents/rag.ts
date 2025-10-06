import { AgentRequest, AgentResponse } from './types';
import { pineconeClient } from '@/app/libs/pinecone';
import { openaiClient } from '@/app/libs/openai/openai';
import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';

export async function ragAgent(request: AgentRequest): Promise<AgentResponse> {
	// Step 1: Generate embedding for the refined query
	const embeddingResponse = await openaiClient.embeddings.create({
		model: 'text-embedding-3-small',
		input: request.query,
	});

	const queryEmbedding = embeddingResponse.data[0].embedding;

	// Step 2: Query Pinecone for initial results
	const index = pineconeClient.Index(process.env.PINECONE_INDEX!);
	const queryResponse = await index.query({
		vector: queryEmbedding,
		topK: 5,
		includeMetadata: true,
		includeValues: false,
	});

	// Step 3: Re-rank using Pinecone's inference API with Cohere
	const documents = queryResponse.matches.map(
		(match) => match.metadata?.text as string
	);

	const reranked = await pineconeClient.inference.rerank(
		'cohere-rerank-3.5',
		request.query,
		documents,
		{
			topN: 5,
		}
	);

	// Step 4: Build context from re-ranked results
	const context = reranked.data
		.map((result) => result.document?.text || '')
		.join('\n\n');

	const systemPrompt = `You are a helpful assistant. Use the following context to answer the user's question. If the context doesn't contain relevant information, say so.

Original User Request: "${request.originalQuery}"

Refined Query: "${request.query}"

Context:
${context}`;

	return streamText({
		model: openai('gpt-4o'),
		system: systemPrompt,
		messages: request.messages,
	});
}
