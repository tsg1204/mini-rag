/**
 * LinkedIn Posts Upload Script
 *
 * Reads a LinkedIn CSV export from:
 *   app/scripts/data/brian_posts.csv
 * extracts posts using extractLinkedInPosts(),
 * chunks the post text, generates embeddings, and uploads to Qdrant.
 *
 * USAGE:
 * 1. Ensure OPENAI_API_KEY is set
 * 2. Run: npx ts-node app/scripts/upload-linkedin-posts.ts
 */

import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { QdrantClient } from '@qdrant/js-client-rest';
import { chunkText, Chunk } from '../libs/chunking';
import { openaiClient } from '../libs/openai/openai';
import { extractLinkedInPosts, LinkedInPost} from '../libs/chunking';

interface ProcessedLinkedInPost {
	post: LinkedInPost;
	chunks: Chunk[];
	embeddings: number[][];
}

/**
 * Path to your CSV file (single file)
 * 
 */
function getLinkedInCsvPath(): string {
	
	const csvPath = path.join(process.cwd(), 'app/scripts/data/brian_posts.csv');

	if (!fs.existsSync(csvPath)) {
		throw new Error(`LinkedIn CSV not found: ${csvPath}`);
	}

	return csvPath;
}

async function embedInBatches(texts: string[], batchSize = 128): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    console.log(`  📊 Embedding batch ${Math.floor(i / batchSize) + 1} (${batch.length} chunks)...`);

    const resp = await openaiClient.embeddings.create({
      model: 'text-embedding-3-small',
      dimensions: 512,
      input: batch,
    });

    out.push(...resp.data.map((d) => d.embedding));
  }
  return out;
}


async function processLinkedInCsvFile(
  filePath: string
): Promise<ProcessedLinkedInPost[]> {
  const csv = fs.readFileSync(filePath, 'utf-8');

  const posts = extractLinkedInPosts(csv);
  if (posts.length === 0) return [];

  console.log(`  🧾 Extracted ${posts.length} posts`);

  // --- NEW: collect all chunks first ---
  const temp: { post: LinkedInPost; chunks: Chunk[] }[] = [];
  const allChunkTexts: string[] = [];
  const owners: { postIndex: number; chunkIndex: number }[] = [];

  for (const post of posts) {
    const text = (post.text ?? '').trim();
    if (text.length < 40) continue;

    const source = post.url || 'linkedin_post';
    const chunks = chunkText(text, 500, 50, source); // <-- 500 here

    if (chunks.length === 0) continue;

    const postIndex = temp.length;
    temp.push({ post, chunks });

    chunks.forEach((chunk, chunkIndex) => {
      allChunkTexts.push(chunk.content);
      owners.push({ postIndex, chunkIndex });
    });
  }

  console.log(`  📦 Total chunks to embed: ${allChunkTexts.length}`);

  // --- NEW: single batched embedding step ---
  const embeddingsFlat = await embedInBatches(allChunkTexts, 128);

  // --- NEW: reassemble per post ---
  const processed: ProcessedLinkedInPost[] = temp.map(({ post, chunks }) => ({
    post,
    chunks,
    embeddings: new Array(chunks.length),
  }));

  embeddingsFlat.forEach((embedding, i) => {
    const { postIndex, chunkIndex } = owners[i];
    processed[postIndex].embeddings[chunkIndex] = embedding;
  });

  return processed;
}


function initializeQdrantClient(): QdrantClient {
	const url = process.env.QDRANT_URL || 'http://localhost:6333';
	const apiKey = process.env.QDRANT_API_KEY;

	return new QdrantClient({
		url,
		...(apiKey && { apiKey }),
	});
}

async function ensureCollection(client: QdrantClient, collectionName: string): Promise<void> {
	try {
		await client.getCollection(collectionName);
		console.log(`  ✓ Collection "${collectionName}" already exists`);
	} catch (error) {
		const errorObj = error as { status?: number; message?: string };
		if (errorObj.status === 404 || errorObj.message?.includes('not found')) {
			console.log(`  📦 Creating collection "${collectionName}"...`);
			await client.createCollection(collectionName, {
				vectors: { size: 512, distance: 'Cosine' as const },
			});
			console.log(`  ✅ Collection "${collectionName}" created`);
		} else {
			throw error;
		}
	}
}

function prepareQdrantVectors(processed: ProcessedLinkedInPost) {
	const { post, chunks, embeddings } = processed;

	const postId = post.url && post.url.trim().length > 0 ? post.url : crypto.randomUUID();

	return chunks.map((chunk, idx) => ({
		id: crypto.randomUUID(),
		vector: embeddings[idx],
		payload: {
			type: 'linkedin_post',
			postId,
			text: chunk.content,
			fullTextLength: (post.text ?? '').length,
			date: post.date,
			url: post.url,
			likes: post.likes,
			chunkIndex: chunk.metadata.chunkIndex,
			totalChunks: chunk.metadata.totalChunks,
			startChar: chunk.metadata.startChar,
			endChar: chunk.metadata.endChar,
		},
	}));
}

async function uploadToQdrant(
	client: QdrantClient,
	collectionName: string,
	vectors: ReturnType<typeof prepareQdrantVectors>
): Promise<number> {
	await ensureCollection(client, collectionName);

	const batchSize = 100;
	let uploaded = 0;

	for (let i = 0; i < vectors.length; i += batchSize) {
		const batch = vectors.slice(i, i + batchSize);

		await client.upsert(collectionName, {
			wait: true,
			points: batch.map((v) => ({
				id: v.id,
				vector: v.vector,
				payload: v.payload,
			})),
		});

		uploaded += batch.length;
	}

	return uploaded;
}

async function main() {
	if (!process.env.OPENAI_API_KEY) {
		console.error('❌ Please set OPENAI_API_KEY environment variable');
		process.exit(1);
	}

	const qdrantClient = initializeQdrantClient();
	const collectionName = 'linkedin';

	console.log('🚀 Starting LinkedIn posts upload...\n');
	console.log(`🔗 Qdrant URL: ${process.env.QDRANT_URL || 'http://localhost:6333'}`);
	console.log(`📚 Collection: ${collectionName}\n`);

	const csvPath = getLinkedInCsvPath();
	console.log(`📄 Using CSV: ${path.basename(csvPath)}\n`);

	const processedPosts = await processLinkedInCsvFile(csvPath);

	if (processedPosts.length === 0) {
		console.log('⚠️  No valid posts to upload. Exiting.');
		return;
	}

	let totalChunks = 0;
	let totalVectors = 0;

	for (let i = 0; i < processedPosts.length; i++) {
		const processed = processedPosts[i];

		// Prepare vectors
		const vectors = prepareQdrantVectors(processed);

		// Upload
		const uploaded = await uploadToQdrant(qdrantClient, collectionName, vectors);

		totalChunks += processed.chunks.length;
		totalVectors += uploaded;

		if ((i + 1) % 10 === 0 || i === processedPosts.length - 1) {
			console.log(
				`  ✅ Uploaded posts: ${i + 1}/${processedPosts.length} (chunks so far: ${totalChunks}, vectors so far: ${totalVectors})`
			);
		}
	}

	console.log('\n' + '='.repeat(50));
	console.log('📊 SUMMARY');
	console.log('='.repeat(50));
	console.log(`🧾 Total posts: ${processedPosts.length}`);
	console.log(`📦 Total chunks: ${totalChunks}`);
	console.log(`🔢 Total vectors: ${totalVectors}`);
	console.log('='.repeat(50));
}

main().catch((error) => {
	console.error('❌ Fatal error:', error);
	process.exit(1);
});
