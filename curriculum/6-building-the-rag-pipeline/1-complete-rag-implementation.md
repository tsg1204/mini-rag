# Complete RAG Implementation

It's time to bring everything together! We've built all the individual pieces:
- ✅ Data scraping and processing
- ✅ Vector embeddings with OpenAI
- ✅ Vector database with Pinecone
- ✅ Understanding of vector similarity

Now let's create a complete, production-ready RAG system that can handle questions with context retrieval and answer generation.

---

## RAG System Architecture

Our complete RAG system will have these core components:

```typescript
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   User Query    │───▶│  Query Vector   │───▶│  Search Results │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │                         │
                              ▼                         ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Knowledge     │◀───│   Pinecone DB   │    │   Context +     │
│   Processing    │    │   (Vectors)     │    │   Generation    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                                                        ▼
                                              ┌─────────────────┐
                                              │  Final Answer   │
                                              └─────────────────┘
```

## Implementing the RAG Pipeline

Let's build the complete pipeline that connects all our components:

```typescript
// lib/rag-pipeline.ts
import { OpenAI } from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';
import { chunkText, Chunk } from './chunking';
import { createEmbeddings } from './embeddings';
import { scrapeWithCheerio } from './scrapers/cheerioScraper';

// Initialize our services
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

const index = pinecone.Index(process.env.PINECONE_INDEX_NAME);

// Step 1: Ingest and process documents
export async function ingestDocument(url: string): Promise<string[]> {
  try {
    // Scrape the content
    const scrapedContent = await scrapeWithCheerio(url);
    if (!scrapedContent) {
      throw new Error(`Failed to scrape content from ${url}`);
    }
    
    // Chunk the content
    const chunks = chunkText(
      scrapedContent.content,
      500, // chunk size
      50,  // overlap
      url  // source
    );
    
    // Create embeddings
    const embeddings = await createEmbeddings(chunks);
    
    // Store in Pinecone
    const ids = await storeEmbeddings(embeddings);
    
    return ids;
  } catch (error) {
    console.error('Error ingesting document:', error);
    throw error;
  }
}

// Step 2: Store embeddings in Pinecone
async function storeEmbeddings(embeddings: Array<{
  id: string;
  values: number[];
  metadata: Record<string, any>;
}>): Promise<string[]> {
  try {
    // Upsert in batches to avoid rate limits
    const batchSize = 100;
    const ids: string[] = [];
    
    for (let i = 0; i < embeddings.length; i += batchSize) {
      const batch = embeddings.slice(i, i + batchSize);
      
      await index.upsert(batch.map(item => ({
        id: item.id,
        values: item.values,
        metadata: item.metadata
      })));
      
      ids.push(...batch.map(item => item.id));
      
      // Simple rate limiting
      if (i + batchSize < embeddings.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    return ids;
  } catch (error) {
    console.error('Error storing embeddings:', error);
    throw error;
  }
}

// Step 3: Query the system
export async function queryRAG(question: string, topK: number = 5): Promise<string> {
  try {
    // Create query embedding
    const queryEmbeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: question,
    });
    
    const queryEmbedding = queryEmbeddingResponse.data[0].embedding;
    
    // Search Pinecone
    const searchResults = await index.query({
      vector: queryEmbedding,
      topK,
      includeMetadata: true
    });
    
    // Extract context from search results
    const context = searchResults.matches
      .map(match => {
        const metadata = match.metadata as Record<string, any>;
        return `[Source: ${metadata.source}]\n${metadata.content}`;
      })
      .join('\n\n');
    
    // Generate answer with context
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a helpful assistant that answers questions based on the provided context. 
          If the context doesn't contain relevant information, say "I don't have enough information to answer that."
          Always cite your sources when possible.`
        },
        {
          role: "user",
          content: `Context:\n${context}\n\nQuestion: ${question}`
        }
      ],
      temperature: 0.5,
    });
    
    return completion.choices[0].message.content || "Sorry, I couldn't generate an answer.";
  } catch (error) {
    console.error('Error querying RAG system:', error);
    throw error;
  }
}
```

---

## Using Our RAG System

Here's how to use our RAG system in a Next.js API route:

```typescript
// app/api/rag/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { ingestDocument, queryRAG } from '@/lib/rag-pipeline';

export async function POST(req: NextRequest) {
  try {
    const { action, url, question } = await req.json();
    
    if (action === 'ingest') {
      if (!url) {
        return NextResponse.json(
          { error: 'URL is required for ingestion' },
          { status: 400 }
        );
      }
      
      const ids = await ingestDocument(url);
      return NextResponse.json({ success: true, ids });
    }
    
    if (action === 'query') {
      if (!question) {
        return NextResponse.json(
          { error: 'Question is required for querying' },
          { status: 400 }
        );
      }
      
      const answer = await queryRAG(question);
      return NextResponse.json({ answer });
    }
    
    return NextResponse.json(
      { error: 'Invalid action. Use "ingest" or "query".' },
      { status: 400 }
    );
  } catch (error) {
    console.error('RAG API error:', error);
    return NextResponse.json(
      { error: 'An error occurred processing your request' },
      { status: 500 }
    );
  }
}
```
---

## What's Next?

We now have a complete, production-ready RAG system! Next, we'll explore how to enhance our system with specialized agents in Section 7, and then in Section 8, we'll learn about building a beautiful Next.js frontend with streaming responses for a better user experience.

<div style="position: relative; padding-bottom: 56.25%; height: 0;"><iframe src="https://www.loom.com/embed/placeholder-complete-rag" frameborder="0" webkitallowfullscreen mozallowfullscreen allowfullscreen style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"></iframe></div>