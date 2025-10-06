import { NextRequest, NextResponse } from 'next/server';
import { DataProcessor } from '@/app/libs/dataProcessor';
import { openaiClient } from '@/app/libs/openai/openai';
import { pineconeClient } from '@/app/libs/pinecone';
import { z } from 'zod';

const uploadDocumentSchema = z.object({
	urls: z.array(z.string().url()).min(1),
});

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const parsed = uploadDocumentSchema.parse(body);
		const { urls } = parsed;

		// Step 1: Scrape and chunk the content
		const processor = new DataProcessor();
		const chunks = await processor.processUrls(urls);

		if (chunks.length === 0) {
			return NextResponse.json(
				{ error: 'No content found to process' },
				{ status: 400 }
			);
		}

		// Step 2: Generate embeddings and upload to Pinecone
		const index = pineconeClient.Index(process.env.PINECONE_INDEX!);
		const batchSize = 100;
		let successCount = 0;

		for (let i = 0; i < chunks.length; i += batchSize) {
			const batch = chunks.slice(i, i + batchSize);

			// Generate embeddings
			const embeddingResponse = await openaiClient.embeddings.create({
				model: 'text-embedding-3-small',
				input: batch.map((chunk) => chunk.content),
			});

			// Prepare vectors for Pinecone
			const vectors = batch.map((chunk, idx) => ({
				id: `${chunk.metadata.url}-${chunk.metadata.chunkIndex}`,
				values: embeddingResponse.data[idx].embedding,
				metadata: {
					text: chunk.content,
					url: chunk.metadata.url || '',
					title: chunk.metadata.title || '',
					chunkIndex: chunk.metadata.chunkIndex || 0,
					totalChunks: chunk.metadata.totalChunks || 0,
				},
			}));

			// Upload to Pinecone
			await index.upsert(vectors);
			successCount += batch.length;
		}

		return NextResponse.json({
			success: true,
			chunksProcessed: chunks.length,
			vectorsUploaded: successCount,
		});
	} catch (error) {
		console.error('Error uploading documents:', error);
		return NextResponse.json(
			{ error: 'Failed to upload documents' },
			{ status: 500 }
		);
	}
}
