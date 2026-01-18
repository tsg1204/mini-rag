/**
 * Article Upload Script
 *
 * This script processes Medium article HTML files from app/scripts/data/articles/
 * and uploads them to Qdrant vector database.
 *
 * WORKFLOW:
 * 1. Reads all HTML files from the articles directory
 * 2. Parses each HTML file using extraMediumArticle() to extract text and metadata
 * 3. Chunks the article text using chunkText()
 * 4. Generates embeddings for each chunk using OpenAI
 * 5. Uploads vectors to Qdrant (placeholder for now)
 *
 * USAGE:
 * 1. Ensure OPENAI_API_KEY is set in your environment
 * 2. Run: npx ts-node app/scripts/upload-articles.ts
 * 3. Monitor progress in the console
 */
import dotenv from 'dotenv';

dotenv.config();
import fs from 'fs';
import path from 'path';
import { QdrantClient } from '@qdrant/js-client-rest';
import { extraMediumArticle, chunkText, Chunk } from '../libs/chunking';
import { openaiClient } from '../libs/openai/openai';


interface ProcessedArticle {
	article: ReturnType<typeof extraMediumArticle>;
	chunks: Chunk[];
	embeddings: number[][];
}

/**
 * Reads all HTML files from the articles directory
 */
function getArticleFiles(): string[] {
	const articlesDir = path.join(
		process.cwd(),
		'app/scripts/data/articles'
	);

	if (!fs.existsSync(articlesDir)) {
		throw new Error(`Articles directory not found: ${articlesDir}`);
	}

	const files = fs.readdirSync(articlesDir);
	return files
		.filter((file) => file.endsWith('.html'))
		.map((file) => path.join(articlesDir, file));
}

/**
 * Processes a single HTML article file
 */
async function processArticle(
	filePath: string
): Promise<ProcessedArticle | null> {
	try {
		// Read HTML file
		const html = fs.readFileSync(filePath, 'utf-8');

    //ignore articles with less that 500 characters
    if (html.length < 500) {
      console.warn(`⚠️  Skipping ${path.basename(filePath)}: Less than 500 characters`);
      return null;
    } 
    else {
      console.log(`📄 Processing ${path.basename(filePath)}: ${html.length} characters`);
    }

		// Extract article data
		const article = extraMediumArticle(html);

		// Skip if no text content
		if (!article.text || article.text.trim().length === 0) {
			console.warn(`⚠️  Skipping ${path.basename(filePath)}: No text content`);
			return null;
		}

		// Chunk the article text
		const chunks = chunkText(
			article.text,
			500, // chunkSize
			50, // overlap
			article.url || article.title || 'unknown'
		);

		if (chunks.length === 0) {
			console.warn(`⚠️  Skipping ${path.basename(filePath)}: No chunks created`);
			return null;
		}

		// Generate embeddings for all chunks
		console.log(
			`  📊 Generating embeddings for ${chunks.length} chunks...`
		);
		const embeddingResponse = await openaiClient.embeddings.create({
			model: 'text-embedding-3-small',
			dimensions: 512,
			input: chunks.map((chunk) => chunk.content),
		});

		const embeddings = embeddingResponse.data.map((item) => item.embedding);

		return {
			article,
			chunks,
			embeddings,
		};
	} catch (error) {
		console.error(`❌ Error processing ${path.basename(filePath)}:`, error);
		return null;
	}
}

/**
 * Prepares vectors for Qdrant upload
 * TODO: Implement actual Qdrant upload
 */
function prepareQdrantVectors(processedArticle: ProcessedArticle) {
	const { article, chunks, embeddings } = processedArticle;

	return chunks.map((chunk, index) => ({
		id: crypto.randomUUID(),
		vector: embeddings[index],
		payload: {
			text: chunk.content,
			source: article.url || article.title,
			title: article.title,
			author: article.author,
			date: article.date,
			url: article.url,
			language: article.language,
			chunkIndex: chunk.metadata.chunkIndex,
			totalChunks: chunk.metadata.totalChunks,
			startChar: chunk.metadata.startChar,
			endChar: chunk.metadata.endChar,
		},
	}));
}

/**
 * Initializes Qdrant client
 */
function initializeQdrantClient(): QdrantClient {
	const url = process.env.QDRANT_URL || 'http://localhost:6333';
	const apiKey = process.env.QDRANT_API_KEY;

	const client = new QdrantClient({
		url,
		...(apiKey && { apiKey }),
	});

	return client;
}

/**
 * Ensures the Qdrant collection exists, creates it if it doesn't
 */
async function ensureCollection(
	client: QdrantClient,
	collectionName: string
): Promise<void> {
	try {
		// Check if collection exists
		await client.getCollection(collectionName);
		console.log(`  ✓ Collection "${collectionName}" already exists`);
	} catch (error) {
		// Collection doesn't exist, create it
		const errorObj = error as { status?: number; message?: string };
		if (errorObj.status === 404 || errorObj.message?.includes('not found')) {
			console.log(`  📦 Creating collection "${collectionName}"...`);
			await client.createCollection(collectionName, {
				vectors: {
					size: 512, // Match embedding dimensions
					distance: 'Cosine' as const,
				},
			});
			console.log(`  ✅ Collection "${collectionName}" created`);
		} else {
			throw error;
		}
	}
}

/**
 * Uploads vectors to Qdrant
 */
async function uploadToQdrant(
	client: QdrantClient,
	collectionName: string,
	vectors: ReturnType<typeof prepareQdrantVectors>
): Promise<number> {
	// Ensure collection exists
	await ensureCollection(client, collectionName);

	// Upload vectors in batches (Qdrant recommends batches of 100-200)
	const batchSize = 100;
	let uploadedCount = 0;

	for (let i = 0; i < vectors.length; i += batchSize) {
		const batch = vectors.slice(i, i + batchSize);
		
		try {
			await client.upsert(collectionName, {
				wait: true, // Wait for the operation to complete
				points: batch.map((v) => ({
					id: v.id,
					vector: v.vector,
					payload: v.payload,
				})),
			});
			
			uploadedCount += batch.length;
		} catch (error) {
			console.error(`  ❌ Error uploading batch ${i / batchSize + 1}:`, error);
			throw error;
		}
	}

	return uploadedCount;
}

async function main() {
	if (!process.env.OPENAI_API_KEY) {
		console.error('❌ Please set OPENAI_API_KEY environment variable');
		process.exit(1);
	}

	// Initialize Qdrant client
	const qdrantClient = initializeQdrantClient();
	const collectionName = process.env.QDRANT_COLLECTION || 'medium_articles';

	console.log('🚀 Starting article upload process...\n');
	console.log(`🔗 Qdrant URL: ${process.env.QDRANT_URL || 'http://localhost:6333'}`);
	console.log(`📚 Collection: ${collectionName}\n`);

	// Get all article files
	const articleFiles = getArticleFiles();
	console.log(`📁 Found ${articleFiles.length} article files\n`);

	if (articleFiles.length === 0) {
		console.log('⚠️  No article files found. Exiting.');
		return;
	}

	let processedCount = 0;
	let skippedCount = 0;
	let totalChunks = 0;
	let totalVectors = 0;

	// Process each article
	for (let i = 0; i < articleFiles.length; i++) {
		const filePath = articleFiles[i];
		const fileName = path.basename(filePath);

		console.log(
			`[${i + 1}/${articleFiles.length}] Processing: ${fileName}`
		);

		const processed = await processArticle(filePath);

		if (!processed) {
			skippedCount++;
			console.log(`  ⏭️  Skipped\n`);
			continue;
		}

		// Prepare vectors for Qdrant
		const vectors = prepareQdrantVectors(processed);

		// Upload to Qdrant
		try {
			const uploadedCount = await uploadToQdrant(
				qdrantClient,
				collectionName,
				vectors
			);

			processedCount++;
			totalChunks += processed.chunks.length;
			totalVectors += uploadedCount;

			console.log(
				`  ✅ Processed: ${processed.chunks.length} chunks, ${uploadedCount} vectors uploaded\n`
			);
		} catch (error) {
			console.error(`  ❌ Failed to upload to Qdrant:`, error);
			skippedCount++;
			console.log(`  ⏭️  Skipped\n`);
		}
	}

	// Summary
	console.log('\n' + '='.repeat(50));
	console.log('📊 SUMMARY');
	console.log('='.repeat(50));
	console.log(`Total files: ${articleFiles.length}`);
	console.log(`✅ Processed: ${processedCount}`);
	console.log(`⏭️  Skipped: ${skippedCount}`);
	console.log(`📦 Total chunks: ${totalChunks}`);
	console.log(`🔢 Total vectors: ${totalVectors}`);
	console.log('='.repeat(50));
}

main().catch((error) => {
	console.error('❌ Fatal error:', error);
	process.exit(1);
});
