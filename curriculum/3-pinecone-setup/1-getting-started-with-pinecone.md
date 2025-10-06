# Getting Started with Pinecone

Now that we understand vectors and embeddings, it's time to set up our vector database! Pinecone is a managed vector database that handles the complex parts of vector search for us.

Think of Pinecone as "PostgreSQL for vectors" - it stores embeddings and can quickly find similar ones at scale.

---

## Why Pinecone?

While there are many vector database options, Pinecone is great for learning because:

- **Managed Service**: No infrastructure to manage
- **Great Free Tier**: Perfect for learning and small projects  
- **Excellent TypeScript SDK**: Well-documented and type-safe
- **Production Ready**: Used by companies like Gong, Hubspot, and others
- **Simple API**: Easy to get started, powerful when you need it

---

## Creating Your Pinecone Account

1. Go to [pinecone.io](https://www.pinecone.io) and sign up for a free account

---

## Understanding Pinecone Concepts

Before we dive into code, let's understand the key concepts:

### Index
An **index** is like a database table, but for vectors. Each index has:
- **Dimension**: Must match your embedding model (1536 for OpenAI's text-embedding-3-small)
- **Metric**: How to measure similarity (cosine, euclidean, dotproduct)
- **Pod Type**: Performance/cost tier

### Vectors
Each vector in your index has:
- **ID**: Unique identifier (string)
- **Values**: The actual embedding (array of numbers)
- **Metadata**: Optional key-value pairs for filtering

```typescript
// Example vector object
{
  id: "doc-123",
  values: [0.1, -0.3, 0.8, ...], // 1536 numbers
  metadata: {
    title: "Introduction to Machine Learning",
    author: "Jane Doe",
    category: "education"
  }
}
```

---

## Setting Up Your First Index

### Step 1: Create an Index via Console

1. In the Pinecone console, click "Create Index"
2. Fill in the details:
   - **Name**: `rag-tutorial` (lowercase, no spaces)
   - **Dimensions**: `512` (for OpenAI embeddings)
   - **Metric**: `cosine` (standard for text similarity)

3. Click "Create Index"

Wait a few minutes for your index to initialize. You'll see a green "Ready" status when it's done.

### Step 2: Get Your API Key

1. Go to "API Keys" in the left sidebar
2. Copy your API key - you'll need this for your code
3. **Important**: Keep this key secret! Don't commit it to git.

---

## Understanding Query Results

When you query Pinecone, you get back results like this:

```typescript
{
  matches: [
    {
      id: "doc-123",
      score: 0.92,        // Similarity score (0-1, higher = more similar)
      values: [...],      // The vector (if includeValues: true)
      metadata: {         // Your custom metadata
        title: "Machine Learning Basics",
        category: "tutorial"
      }
    },
    // ... more results
  ]
}
```

The `score` is the similarity score based on your chosen metric (cosine similarity in our case).

---

## Exercise: Explore the Console

1. Go to your Pinecone console
2. Click on your `rag-tutorial` index
3. Try the "Query" tab - you can manually query your index
4. Look at the "Metrics" tab to see usage statistics

Play around with the interface to get comfortable with it!

---

## Common Gotchas

- **Dimension Mismatch**: Your vectors must match the index dimension exactly
- **API Rate Limits**: Free tier has rate limits - don't hammer the API
- **Async Operations**: Vector upserts aren't immediately available for querying
- **Case Sensitivity**: Index names must be lowercase

---

## What's Next?

Now that Pinecone is set up and working, we need add some data to use in our app.

<div style="position: relative; padding-bottom: 56.25%; height: 0;"><iframe src="https://www.loom.com/embed/placeholder-pinecone-setup" frameborder="0" webkitallowfullscreen mozallowfullscreen allowfullscreen style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"></iframe></div>