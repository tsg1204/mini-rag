# Setting Up OpenAI for RAG

Now that we've gathered and processed our data from the previous section, it's time to bring our RAG system to life with real AI! We'll use OpenAI for two key purposes:

1. **Embeddings**: Convert our scraped text chunks into vectors for storage in Pinecone
2. **Chat Completions**: Generate answers based on retrieved context

By the end of this section, you'll have a working connection to OpenAI and understand how to use both embedding and chat completion models.

---

## Getting Your OpenAI API Key

### Step 1: Create an OpenAI Account

1. Go to [platform.openai.com](https://platform.openai.com)
2. Sign up or log in to your account
3. Navigate to the "API Keys" section
4. Click "Create new secret key"
5. **Important**: Copy the key immediately - you won't see it again!

### Step 2: Add Credits (If Needed)

The OpenAI API is pay-per-use. You'll need to add a payment method and some credits:
- Go to "Billing" in your OpenAI dashboard
- Add a payment method
- Add $5-10 in credits (this will last you a long time for learning)

**Cost Breakdown:**
- Embeddings: ~$0.0001 per 1K tokens (very cheap!)
- GPT-4o mini: ~$0.15 per 1M input tokens
- For our tutorials, $5 will be enough

---

## Understanding OpenAI Models

OpenAI offers different models for different purposes:

### Embedding Models
These convert text to vectors:

- **text-embedding-3-small**: 1536 dimensions, fast and cheap
- **text-embedding-3-large**: 3072 dimensions, more accurate but pricier
- **text-embedding-ada-002**: Legacy model, still works but older

We'll use `text-embedding-3-small` - it's perfect for learning and most production use cases and also the embedding type we provided when we created our index.

⚠️ **CRITICAL**: Your embedding model dimensions MUST match the dimensions you chose when creating your Pinecone index. For example, if you created a Pinecone index with 1536 dimensions, you must use text-embedding-3-small and specify that you want to use 1536 dimensions. Using mismatched dimensions will prevent proper searching.

### Chat Models
These generate text responses:

- **gpt-5o**: Jury is out
- **gpt-4o**: Most capable, best reasoning
- **gpt-4o-mini**: Great balance of speed/cost/quality (our choice)
- **gpt-3.5-turbo**: Cheaper but less capable

---

## Embedding Our Document Chunks

Now let's embed the document chunks we created in the previous section:

```typescript
// lib/embeddings.ts
import { OpenAI } from 'openai';
import { Chunk } from './chunking';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function createEmbeddings(chunks: Chunk[]): Promise<Array<{
  id: string;
  values: number[];
  metadata: Record<string, any>;
}>> {
  const results = [];
  
  // Process in batches to avoid rate limits
  for (let i = 0; i < chunks.length; i += 10) {
    const batch = chunks.slice(i, i + 10);
    const batchTexts = batch.map(chunk => chunk.content);
    
    try {
      const response = await openai.embeddings.create({
        model: "text-embedding-3-small", // 512 dimensions
        input: batchTexts,
      });
      
      // Map embeddings to chunks
      for (let j = 0; j < batch.length; j++) {
        const chunk = batch[j];
        const embedding = response.data[j].embedding;
        
        results.push({
          id: chunk.id,
          values: embedding,
          metadata: chunk.metadata
        });
      }
      
      // Simple rate limiting
      if (i + 10 < chunks.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    } catch (error) {
      console.error(`Error creating embeddings for batch ${i}:`, error);
      throw error;
    }
  }
  
  return results;
}
```

---

## Exercise: Research Different Models

Research different OpenAI models:

1. Why would someone use `text-embedding-3-large` instead of `text-embedding-3-small`
2. What is quality difference between `gpt-4o-mini` and `gpt-4o`

What would you choose for this app and why?
---

## What's Next?

We now have both pieces of the RAG puzzle working:
- ✅ Vector storage (Pinecone)
- ✅ Text embeddings (OpenAI)
- ✅ Answer generation (OpenAI)

In the next section, we'll build the complete RAG pipeline that connects all these components together.

<div style="position: relative; padding-bottom: 56.25%; height: 0;"><iframe src="https://www.loom.com/embed/placeholder-openai-setup" frameborder="0" webkitallowfullscreen mozallowfullscreen allowfullscreen style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"></iframe></div>