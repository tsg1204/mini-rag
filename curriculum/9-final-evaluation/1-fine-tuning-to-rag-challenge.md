# RAG Applications - Final Evaluation

---

## The Challenge - LinkedIn Style Writer with RAG

Remember the fine-tuning exercise we did earlier? We tried to train a model to write in a specific style, but the results weren't great. Now you'll learn why RAG is often a better approach, and you'll build a production-quality solution.

### Why RAG Over Fine-Tuning?

**Fine-tuning limitations:**
- ❌ Expensive to train and update
- ❌ Bakes knowledge into model weights
- ❌ Hard to update with new examples
- ❌ Requires retraining for new styles
- ❌ Black box - can't see what it learned

**RAG advantages:**
- ✅ Easy to add new examples instantly
- ✅ Transparent - see which examples are used
- ✅ Flexible - adjust matching threshold dynamically
- ✅ Cost-effective - no expensive training
- ✅ Fallback options when no good matches found

---

Build a RAG-based writing assistant that:

1. **Ingests LinkedIn Articles**: Vectorize a collection of LinkedIn articles
2. **Finds Similar Examples**: When given a topic, find relevant writing examples (similarity score >= 0.5)
3. **Generates Styled Content**: Use matched examples to write in that style
4. **Smart Fallbacks**: When similarity < 0.5, use generic ChatGPT with clear user notification

Your application should be able to:
- Accept a topic/prompt from the user
- Search vectorized articles for similar content
- Only use articles with similarity score >= 0.5 as style examples
- Generate styled content when matches found
- Fall back to generic generation when no suitable matches (< 0.5)
- Show the user which articles were matched and their scores
- Clearly indicate whether output is styled or generic

---

## Where to Start

- Fork and clone [this repo](https://github.com/projectshft/rag-style-writer). Submit a pull request when you're finished.
- Commit often!
- Before coding, sketch out your data flow:
  1. Article ingestion → Embeddings → Pinecone
  2. User query → Embedding → Similarity search
  3. Threshold check → Styled or Generic generation
  4. Response with metadata
- Set up your environment variables (OpenAI, Pinecone)
- Test with provided sample articles first

---

## Core Requirements

### Requirement 1: Data Ingestion Pipeline

Create a pipeline to:
- Load LinkedIn articles (sample data provided in repo)
- Chunk articles appropriately for embedding (200-500 tokens recommended)
- Generate embeddings using OpenAI's `text-embedding-3-small`
- Store vectors in Pinecone with metadata

```typescript
// Example metadata structure
{
  id: "article-123",
  values: [...], // Embedding vector
  metadata: {
    title: "5 Ways to Improve Your Code Reviews",
    author: "Your Name",
    publishDate: "2024-01-15",
    category: "Engineering",
    wordCount: 850,
    excerpt: "Code reviews are crucial for...",
    url: "https://linkedin.com/article/..."
  }
}
```

### Requirement 2: Similarity Search with 0.5 Threshold

Implement search that:
- Finds similar articles based on user's topic
- Uses cosine similarity with **0.5 minimum threshold**
- Returns top 3 matches if threshold met
- Returns empty if no matches meet threshold

```typescript
interface SearchResult {
  matchFound: boolean;
  matches: Array<{
    id: string;
    score: number;
    title: string;
    excerpt: string;
    fullText: string;
  }>;
}

async function findSimilarArticles(
  topic: string,
  minScore: number = 0.5
): Promise<SearchResult> {
  // Your implementation here
}
```

### Requirement 3: Styled Content Generation

Create a generation system that:

**When matches found (score >= 0.5):**
- Passes matched articles as context
- Instructs LLM to match style, tone, structure
- Generates content that feels consistent

**When no matches (score < 0.5):**
- Uses general LLM capabilities
- Clearly indicates to user: "No suitable style match found, generating generic content"
- Still produces helpful content, just not style-matched

```typescript
interface GenerationResult {
  content: string;
  matchStatus: 'styled' | 'generic';
  message: string;
  matchedArticles?: Array<{
    title: string;
    score: number;
  }>;
}

async function generateArticle(
  topic: string,
  tone: 'professional' | 'casual'
): Promise<GenerationResult> {
  const search = await findSimilarArticles(topic);

  if (search.matchFound) {
    // Use matched articles as style examples
    return {
      content: await generateStyledContent(topic, search.matches),
      matchStatus: 'styled',
      message: `Generated in your style based on ${search.matches.length} similar articles`,
      matchedArticles: search.matches.map(m => ({
        title: m.title,
        score: m.score
      }))
    };
  } else {
    // Fallback to generic generation
    return {
      content: await generateGenericContent(topic),
      matchStatus: 'generic',
      message: 'No suitable style match found (similarity < 0.5). Generated using default ChatGPT style.',
      matchedArticles: []
    };
  }
}
```

### Requirement 4: User Interface

Build a simple interface (can be CLI or web-based) that:
- Lets user input topic/prompt
- Shows similarity scores of matched articles
- Displays generated content
- Clearly indicates whether styled or generic
- Shows which articles were used for style matching

```typescript
// Example output
{
  topic: "Improving Team Communication",
  generatedContent: "Team communication is the cornerstone...",
  status: "styled",
  message: "Generated in your style based on 3 similar articles",
  matches: [
    { title: "Building Better Teams", score: 0.87 },
    { title: "Communication Best Practices", score: 0.72 },
    { title: "Leading Remote Teams", score: 0.63 }
  ]
}
```

---

## Don't Forget

- Error handling and edge cases
- Type safety with TypeScript
- Clear console logging for debugging
- Test both high and low similarity scenarios
- Commit frequently with descriptive messages

---

## Extensions

### Extension 1: Category Filtering

Add filtering by article category:
```typescript
interface SearchOptions {
  minScore: number;
  category?: string; // 'Engineering', 'Leadership', 'Career'
  dateRange?: { start: Date; end: Date };
}
```

### Extension 2: Dynamic Threshold

Allow users to adjust the similarity threshold:
```typescript
interface GenerationOptions {
  minScore: number; // User can set from 0.3 to 0.8
  maxExamples: number; // How many examples to use
}
```

### Extension 3: A/B Comparison

Generate both styled and generic versions, let user compare:
```typescript
interface ComparisonResult {
  styled: string;
  generic: string;
  matchScore: number;
  recommendation: 'styled' | 'generic';
}
```

### Extension 4: Hybrid Generation (Very Difficult)

Blend style-matched and generic based on score ranges:
- If score is 0.4-0.5: Light style influence
- If score is 0.5-0.7: Moderate style influence
- If score is 0.7+: Strong style influence

---

## Technical Implementation Guide

**Note:** The sections below provide detailed implementation guidance. You can use these as a reference, but feel free to architect your solution differently!

### Step 1: Setup

```bash
# Install dependencies
npm install openai @pinecone-database/pinecone cheerio zod

# Setup environment variables
OPENAI_API_KEY=your_key
PINECONE_API_KEY=your_key
PINECONE_INDEX_NAME=linkedin-articles
```

### Step 2: Chunking Strategy

For LinkedIn articles, use semantic chunking:

```typescript
interface ArticleChunk {
  articleId: string;
  chunkIndex: number;
  text: string;
  type: 'intro' | 'body' | 'conclusion';
}

function chunkArticle(article: string): ArticleChunk[] {
  // Chunk by paragraphs, keeping related content together
  // Aim for 200-500 tokens per chunk
  // Keep intros and conclusions as separate chunks
}
```

### Step 3: Embedding and Storage

```typescript
import OpenAI from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';

async function embedAndStore(articles: Article[]) {
  const openai = new OpenAI();
  const pinecone = new Pinecone();
  const index = pinecone.index('linkedin-articles');

  for (const article of articles) {
    // Generate embedding
    const embedding = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: article.fullText
    });

    // Store in Pinecone
    await index.upsert([{
      id: article.id,
      values: embedding.data[0].embedding,
      metadata: {
        title: article.title,
        author: article.author,
        publishDate: article.publishDate,
        category: article.category,
        excerpt: article.excerpt.substring(0, 500),
        fullText: article.fullText.substring(0, 2000) // Store limited text
      }
    }]);
  }
}
```

### Step 4: Similarity Search

```typescript
async function searchSimilarArticles(
  query: string,
  minScore: number = 0.5
): Promise<SearchResult> {
  const openai = new OpenAI();
  const pinecone = new Pinecone();
  const index = pinecone.index('linkedin-articles');

  // Generate query embedding
  const queryEmbedding = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: query
  });

  // Search Pinecone
  const results = await index.query({
    vector: queryEmbedding.data[0].embedding,
    topK: 10,
    includeMetadata: true
  });

  // Filter by threshold
  const matches = results.matches
    .filter(match => match.score >= minScore)
    .slice(0, 3)
    .map(match => ({
      id: match.id,
      score: match.score,
      title: match.metadata.title as string,
      excerpt: match.metadata.excerpt as string,
      fullText: match.metadata.fullText as string
    }));

  return {
    matchFound: matches.length > 0,
    matches
  };
}
```

### Step 5: Style-Matched Generation

```typescript
async function generateStyledContent(
  topic: string,
  examples: Array<{ title: string; fullText: string }>
): Promise<string> {
  const openai = new OpenAI();

  const examplesContext = examples.map((ex, idx) =>
    `Example ${idx + 1}: ${ex.title}\n${ex.fullText}`
  ).join('\n\n---\n\n');

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are a writing assistant. Analyze the style, tone, and structure
of the example articles provided, then write a new article about the given topic
that matches that style.

Pay attention to:
- Sentence structure and length
- Tone (formal/casual, personal/objective)
- Use of examples and anecdotes
- Introduction and conclusion patterns
- Paragraph structure
- Use of questions, lists, or other formatting

Examples of the author's style:

${examplesContext}`
      },
      {
        role: 'user',
        content: `Write an article about: ${topic}`
      }
    ],
    temperature: 0.7
  });

  return completion.choices[0].message.content;
}
```

### Step 6: Generic Fallback

```typescript
async function generateGenericContent(topic: string): Promise<string> {
  const openai = new OpenAI();

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: 'You are a helpful writing assistant. Write a clear, engaging article about the given topic.'
      },
      {
        role: 'user',
        content: `Write an article about: ${topic}`
      }
    ],
    temperature: 0.7
  });

  return completion.choices[0].message.content;
}
```

---

## Testing Your Solution

### Test Case 1: High Similarity Match
```typescript
const result = await generateArticle(
  'Best practices for code reviews in distributed teams',
  'professional'
);

// Expected:
// - matchStatus: 'styled'
// - matchedArticles.length > 0
// - All scores >= 0.5
// - Content should match author's style
```

### Test Case 2: Low Similarity (Fallback)
```typescript
const result = await generateArticle(
  'The history of Byzantine architecture in the 15th century',
  'professional'
);

// Expected:
// - matchStatus: 'generic'
// - matchedArticles.length === 0
// - Message indicates no style match
// - Content is still good, just not style-matched
```

### Test Case 3: Edge of Threshold
```typescript
// Test with articles that score close to 0.5
// Verify behavior is correct at boundary
```

---

## What You'll Learn

By completing this challenge, you'll understand:
- **Why RAG > Fine-tuning** for many use cases
- **Threshold-based matching** for quality control
- **Graceful fallbacks** for better UX
- **Vector similarity** in production
- **Building complete RAG systems**

This is a real-world pattern used in production systems. Master it and you'll be able to build sophisticated AI applications!

---

## Resources

- [Pinecone Documentation](https://docs.pinecone.io)
- [OpenAI Embeddings Guide](https://platform.openai.com/docs/guides/embeddings)
- [Chunking Strategies](https://www.pinecone.io/learn/chunking-strategies/)
- [Similarity Metrics](../../2-vector-math-basics/2-similarity-calculations.md)

---

<div style="position: relative; padding-bottom: 56.25%; height: 0;"><iframe src="https://www.loom.com/embed/placeholder-final-challenge" frameborder="0" webkitallowfullscreen mozallowfullscreen allowfullscreen style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"></iframe></div>
