# Reranking Search Results

Your RAG pipeline is working! But there's a problem: **vector similarity alone isn't always enough to find the most relevant results.**

---

## The Problem with Vector-Only Search

Consider this query: **"How do I fix authentication errors?"**

Your vector search might return:
1. Score: 0.89 - "Authentication is a security process..."
2. Score: 0.87 - "Common authentication patterns include OAuth..."
3. Score: 0.85 - **"To fix authentication errors, check your API keys..."** ⭐ (Most useful!)
4. Score: 0.84 - "Authentication middleware handles requests..."
5. Score: 0.83 - "JWT tokens are used for authentication..."

The **most relevant answer** (fixing errors) ranks #3, but less actionable content ranks higher due to pure vector similarity!

---

## What is Reranking?

**Reranking** is a second-pass process that reorders search results using a more sophisticated model that understands:
- **Query intent** (the user wants to "fix" something)
- **Relevance** (fixes are more relevant than definitions)
- **Context** (full semantic meaning beyond vector similarity)

### How It Works

```typescript
┌─────────────────┐
│   User Query    │ "How do I fix auth errors?"
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Vector Search   │ Returns top 20 candidates
│   (Fast)        │ Based on cosine similarity
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Reranker      │ Reorders to top 5 most relevant
│  (Accurate)     │ Uses cross-encoder model
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  LLM Context    │ Higher quality context!
└─────────────────┘
```

**Two-stage approach:**
1. **Retrieval**: Cast a wide net with vector search (fast, gets ~20-50 candidates)
2. **Reranking**: Use a smarter model to pick the best results (slower, but higher quality)

---

## Why Reranking Matters

### Before Reranking:
```typescript
Top result: "Authentication is the process of verifying identity..."
// Generic definition, not helpful for fixing errors
```

### After Reranking:
```typescript
Top result: "To fix authentication errors, check: 1) API key validity..."
// Actionable solution, directly addresses the query!
```

**Benefits:**
- ✅ **Better answer quality** - More relevant context = better LLM responses
- ✅ **Improved precision** - Focuses on user intent, not just keywords
- ✅ **Cost effective** - Retrieve many candidates cheaply, then rerank the best
- ✅ **Handles ambiguity** - Understands nuanced queries better than vectors alone

---

## Popular Reranking Solutions

### 1. **Cohere Rerank API** (Easiest)
```typescript
import { CohereClient } from 'cohere-ai';

const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY,
});

const reranked = await cohere.rerank({
  model: 'rerank-english-v3.0',
  query: question,
  documents: searchResults.map(r => r.metadata.content),
  topN: 5,
});
```

### 2. **Voyage AI Rerank** (High Performance)
```typescript
import VoyageAIClient from 'voyageai';

const voyageai = new VoyageAIClient({
  apiKey: process.env.VOYAGE_API_KEY
});

const reranked = await voyageai.rerank({
  query: question,
  documents: searchResults.map(r => r.metadata.content),
  model: "rerank-2",
  topK: 5,
});
```

### 3. **Jina AI Reranker** (Open Source Option)
```typescript
const response = await fetch('https://api.jina.ai/v1/rerank', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.JINA_API_KEY}`
  },
  body: JSON.stringify({
    model: 'jina-reranker-v2-base-multilingual',
    query: question,
    documents: searchResults.map(r => r.metadata.content),
    top_n: 5
  })
});
```

---

## When to Use Reranking

**✅ Use reranking when:**
- Queries are complex or ambiguous
- Answer quality is critical
- You have a large knowledge base
- Users expect precise, relevant results

**⚠️ Skip reranking when:**
- Your vector search is already highly accurate
- Latency is more important than precision
- Knowledge base is small and focused
- Budget is extremely tight

---

## Challenge: Add Reranking to Your RAG Pipeline

**Your Task:** Enhance your `queryRAG` function to include reranking using **Cohere's Rerank API**.

### Requirements:

1. **Install the Cohere SDK:**
   ```bash
   npm install cohere-ai
   ```

2. **Modify your `queryRAG` function** to:
   - Retrieve **top 20** results from Pinecone (instead of 5)
   - Pass results through Cohere's reranker
   - Use the **top 5 reranked results** as context for the LLM

3. **Environment Setup:**
   - Get a free API key from [Cohere](https://dashboard.cohere.com/)
   - Add `COHERE_API_KEY` to your `.env.local`

### Expected Implementation:

```typescript
// lib/rag-pipeline.ts
import { CohereClient } from 'cohere-ai';

const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY,
});

export async function queryRAG(question: string): Promise<string> {
  try {
    // 1. Create query embedding
    const queryEmbeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: question,
    });

    const queryEmbedding = queryEmbeddingResponse.data[0].embedding;

    // 2. Search Pinecone - GET MORE CANDIDATES
    const searchResults = await index.query({
      vector: queryEmbedding,
      topK: 20, // ⬅️ Increased from 5 to 20
      includeMetadata: true
    });

    // 3. RERANK RESULTS (Your implementation here!)
    // TODO: Use Cohere to rerank the searchResults
    // - Extract documents from searchResults
    // - Call cohere.rerank()
    // - Get top 5 reranked results

    // 4. Build context from reranked results
    const context = /* Your reranked results */ '';

    // 5. Generate answer with LLM
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

### Testing Your Implementation:

Test with a query where reranking should make a difference:

```typescript
// Test your reranked RAG
const answer = await queryRAG("How do I fix authentication errors in my API?");
console.log(answer);

// The reranked results should prioritize "how to fix" content
// over generic "what is authentication" definitions
```

### Bonus Challenges:

1. **Compare Results**: Log the scores before and after reranking to see the difference
2. **Optimize topK**: Experiment with different values (10, 20, 50) for initial retrieval
3. **Add Metrics**: Track which results get promoted/demoted by reranking
4. **Hybrid Approach**: Make reranking optional with a flag for performance testing

---

## Key Takeaways

- 🎯 **Vector search finds candidates, reranking finds the best**
- 📊 Reranking typically improves relevance by 20-30%
- ⚡ Two-stage retrieval (broad search → precise rerank) is cost-effective
- 🔧 Simple API integrations (Cohere, Voyage, Jina) make it easy to implement

Once you've added reranking, you'll notice significantly better answer quality, especially for complex or ambiguous questions!

---

**Next:** Move on to Section 7 where we'll explore specialized AI agents that can enhance your RAG system even further.

<div style="position: relative; padding-bottom: 56.25%; height: 0;"><iframe src="https://www.loom.com/embed/placeholder-reranking" frameborder="0" webkitallowfullscreen mozallowfullscreen allowfullscreen style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"></iframe></div>
