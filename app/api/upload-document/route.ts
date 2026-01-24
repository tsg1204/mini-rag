// app/api/upload/route.ts
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { QdrantClient } from '@qdrant/js-client-rest';
import { openaiClient } from '@/app/libs/openai/openai';
import { chunkText } from '@/app/libs/chunking';

export const runtime = 'nodejs';

type UploadType = 'article' | 'linkedin';
type DryRunMode = false | 'noUpload' | 'noUploadNoEmbed';

type UploadBody = {
	type: UploadType;
	content: string;
	metadata?: Record<string, unknown>;
	dryRun?: DryRunMode;
	previewLimit?: number; // how many points to include in response preview
};

function qdrant() {
	const url = process.env.QDRANT_URL || 'http://localhost:6333';
	const apiKey = process.env.QDRANT_API_KEY;
	return new QdrantClient({ url, ...(apiKey ? { apiKey } : {}) });
}

async function ensureCollection(client: QdrantClient, name: string) {
	try {
		await client.getCollection(name);
	} catch (error) {
		const e = error as { status?: number; message?: string };
		if (e.status === 404 || e.message?.toLowerCase().includes('not found')) {
			await client.createCollection(name, {
				vectors: { size: 512, distance: 'Cosine' as const },
			});
		} else {
			throw error;
		}
	}
}

function pickConfig(type: UploadType) {
	if (type === 'article') {
		return {
			collection: process.env.QDRANT_COLLECTION_ARTICLES || 'articles',
			chunkSize: 500,
			overlap: 50,
			payloadType: 'article' as const,
		};
	}
	return {
		collection: process.env.QDRANT_COLLECTION_LINKEDIN || 'linkedin',
		chunkSize: 350, // change to 500 for consistency
		overlap: 50,
		payloadType: 'linkedin_post' as const,
	};
}

function ensurePreviewDir(): string {
	const dir = path.join(process.cwd(), 'app', 'scripts', 'data', '_dryruns');
	fs.mkdirSync(dir, { recursive: true });
	return dir;
}

function dummyVector512(): number[] {
	// Stable dummy (all zeros). Useful for noUploadNoEmbed.
	return new Array(512).fill(0);
}

export async function POST(req: Request) {
	try {
		const body = (await req.json()) as UploadBody;

		if (!body?.type || (body.type !== 'article' && body.type !== 'linkedin')) {
			return NextResponse.json(
				{ error: 'type must be "article" or "linkedin"' },
				{ status: 400 }
			);
		}
		if (!body?.content || typeof body.content !== 'string') {
			return NextResponse.json(
				{ error: 'content is required (string)' },
				{ status: 400 }
			);
		}

		const dryRun: DryRunMode = body.dryRun ?? false;
		const previewLimit = Math.max(0, Math.min(body.previewLimit ?? 3, 20));

		const content = body.content.trim();
		if (content.length < (body.type === 'article' ? 50 : 10)) {
			return NextResponse.json({ error: 'content is too short' }, { status: 400 });
		}

		const meta = (body.metadata ?? {}) as Record<string, unknown>;
		const cfg = pickConfig(body.type);

		// Create/verify collection unless it's a dry-run (optional)
		// If you want dry-run to avoid touching Qdrant at all, keep this guarded:
		let client: QdrantClient | null = null;
		if (!dryRun) {
			client = qdrant();
			await ensureCollection(client, cfg.collection);
		}

		const url = String(meta.url ?? meta.link ?? '');
		const title = String(meta.title ?? '');
		const sourceId = url || title || cfg.payloadType;

		const chunks = chunkText(content, cfg.chunkSize, cfg.overlap, sourceId);
		if (chunks.length === 0) {
			return NextResponse.json({ error: 'No chunks created' }, { status: 400 });
		}

		// Embeddings
		let vectors: number[][];

		if (dryRun === 'noUploadNoEmbed') {
			vectors = chunks.map(() => dummyVector512());
		} else {
			if (!process.env.OPENAI_API_KEY) {
				return NextResponse.json(
					{ error: 'OPENAI_API_KEY is not set (required for embeddings)' },
					{ status: 500 }
				);
			}
			const emb = await openaiClient.embeddings.create({
				model: 'text-embedding-3-small',
				dimensions: 512,
				input: chunks.map((c) => c.content),
			});
			vectors = emb.data.map((d) => d.embedding);
		}

		const postId =
			body.type === 'linkedin' ? (url.trim() ? url : crypto.randomUUID()) : undefined;

		const likesRaw = meta.likes ?? meta.numReactions ?? 0;
		const likes =
			typeof likesRaw === 'number' ? likesRaw : parseInt(String(likesRaw), 10) || 0;

		const points = chunks.map((chunk, i) => ({
			id: crypto.randomUUID(),
			vector: vectors[i],
			payload: {
				type: cfg.payloadType,
				source: sourceId,
				text: chunk.content,

				// normalized fields
				url: url || undefined,
				title: title || undefined,
				date: meta.date ?? meta.createdAt ?? undefined,

				// linkedin-only normalized fields
				...(body.type === 'linkedin'
					? { postId, likes, fullTextLength: content.length }
					: {}),

				// keep extra metadata too
				...meta,

				// chunk metadata
				chunkIndex: chunk.metadata.chunkIndex,
				totalChunks: chunk.metadata.totalChunks,
				startChar: chunk.metadata.startChar,
				endChar: chunk.metadata.endChar,
			},
		}));

		// DRY RUN: write to file, return preview
		if (dryRun) {
			const dir = ensurePreviewDir();
			const stamp = new Date().toISOString().replace(/[:.]/g, '-');
			const filename = `${stamp}-${body.type}-${crypto.randomUUID().slice(0, 8)}.json`;
			const filePath = path.join(dir, filename);

			fs.writeFileSync(
				filePath,
				JSON.stringify(
					{
						type: body.type,
						collection: cfg.collection,
						chunkSize: cfg.chunkSize,
						overlap: cfg.overlap,
						points,
					},
					null,
					2
				),
				'utf-8'
			);

			return NextResponse.json({
				ok: true,
				dryRun,
				type: body.type,
				collection: cfg.collection,
				chunks: chunks.length,
				points: points.length,
				fileWritten: filePath,
				preview: points.slice(0, previewLimit).map((p) => ({
					id: p.id,
					payload: p.payload,
					vectorPreview: {
						dim: p.vector.length,
						head: p.vector.slice(0, 5),
					},
				})),
			});
		}

		// REAL UPLOAD
		await client!.upsert(cfg.collection, { wait: true, points });

		return NextResponse.json({
			ok: true,
			type: body.type,
			collection: cfg.collection,
			chunks: chunks.length,
			vectorsUploaded: points.length,
			...(postId ? { postId } : {}),
		});
	} catch (err) {
		console.error('upload error:', err);
		return NextResponse.json({ error: 'Failed to upload' }, { status: 500 });
	}
}
