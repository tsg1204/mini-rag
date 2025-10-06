# Web Scraping for RAG Data

A RAG system is only as good as its knowledge base! In this section, we'll learn how to scrape and process real web content to build a substantial dataset for our RAG application.

We'll cover multiple data sources:
- Web scraping with Puppeteer
- Markdown file parsing
- API data ingestion

By the end, you'll have a robust data pipeline that can handle various content types.

---

## Why Good Data Matters

Remember: **Garbage in, garbage out**. The quality of your RAG system depends heavily on:

- **Relevance**: Content should match your use case
- **Quality**: Well-written, accurate information
- **Freshness**: Up-to-date content when applicable
- **Diversity**: Different perspectives and sources
- **Structure**: Clean, properly formatted text

---

## Basic Web Scraping with Cheerio

For simple, static websites, Cheerio is fast and efficient:

```typescript
// lib/scrapers/cheerioScraper.ts
import axios from 'axios';
import * as cheerio from 'cheerio';

export interface ScrapedContent {
  title: string;
  content: string;
  url: string;
  metadata: Record<string, any>;
}

export async function scrapeWithCheerio(url: string): Promise<ScrapedContent | null> {
  try {
    console.log(`Scraping ${url} with Cheerio...`);
    
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RAG-Bot/1.0)'
      }
    });
    
    const $ = cheerio.load(response.data);
    
    // Remove unwanted elements
    $('script, style, nav, footer, .advertisement').remove();
    
    // Extract title
    const title = $('title').text().trim() || 
                  $('h1').first().text().trim() || 
                  'Untitled';
    
    // Extract main content
    const contentElements = $('main, article, .content, .post-content, p');
    const content = contentElements.map((_, el) => $(el).text()).get().join('\n\n');
    
    // Clean up content
    const cleanContent = content
      .replace(/\s+/g, ' ')  // Normalize whitespace
      .replace(/\n+/g, '\n') // Normalize line breaks
      .trim();
    
    if (!cleanContent || cleanContent.length < 100) {
      console.warn(`Insufficient content from ${url}`);
      return null;
    }
    
    return {
      title,
      content: cleanContent,
      url,
      metadata: {
        scrapedAt: new Date().toISOString(),
        method: 'cheerio',
        contentLength: cleanContent.length
      }
    };
    
  } catch (error) {
    console.error(`Error scraping ${url}:`, error);
    return null;
  }
}
```

---


## Content Chunking for RAG

Once we have scraped content, we need to break it into meaningful chunks for vector storage and retrieval. This step is **critical** - poor chunking leads to irrelevant results and broken context.

### Why Chunking Matters

- **Retrieval Quality**: Well-chunked content returns relevant, coherent results
- **Context Preservation**: Maintains meaning across chunk boundaries  
- **Embedding Performance**: Optimal size for embedding models (~300-800 characters)
- **User Experience**: Complete, understandable answers

### Basic Chunking Implementation

Here's a simple sentence-aware chunking function to get started:

```typescript
// lib/chunking.ts
export interface Chunk {
  id: string;
  content: string;
  metadata: {
    source: string;
    chunkIndex: number;
    totalChunks: number;
    startChar: number;
    endChar: number;
  };
}

export function chunkText(
  text: string, 
  chunkSize: number = 500, 
  overlap: number = 50,
  source: string = 'unknown'
): Chunk[] {
  
  const chunks: Chunk[] = [];
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  
  let currentChunk = '';
  let chunkStart = 0;
  let chunkIndex = 0;
  
  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i].trim() + '.';
    
    // If adding this sentence would exceed chunk size, create a chunk
    if (currentChunk.length + sentence.length > chunkSize && currentChunk.length > 0) {
      
      const chunk: Chunk = {
        id: `${source}-chunk-${chunkIndex}`,
        content: currentChunk.trim(),
        metadata: {
          source,
          chunkIndex,
          totalChunks: 0, // Will be updated later
          startChar: chunkStart,
          endChar: chunkStart + currentChunk.length
        }
      };
      
      chunks.push(chunk);
      
      // Start new chunk with overlap
      const overlapText = getLastWords(currentChunk, overlap);
      currentChunk = overlapText + ' ' + sentence;
      chunkStart = chunk.metadata.endChar - overlapText.length;
      chunkIndex++;
      
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
    }
  }
  
  // Add final chunk if it has content
  if (currentChunk.trim()) {
    chunks.push({
      id: `${source}-chunk-${chunkIndex}`,
      content: currentChunk.trim(),
      metadata: {
        source,
        chunkIndex,
        totalChunks: 0,
        startChar: chunkStart,
        endChar: chunkStart + currentChunk.length
      }
    });
  }
  
  // Update total chunks count
  chunks.forEach(chunk => {
    chunk.metadata.totalChunks = chunks.length;
  });
  
  return chunks;
}

function getLastWords(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  
  const words = text.split(' ');
  let result = '';
  
  for (let i = words.length - 1; i >= 0; i--) {
    const word = words[i];
    if (result.length + word.length + 1 > maxLength) break;
    result = word + (result ? ' ' + result : '');
  }
  
  return result;
}
```

## Exercise: Choose Your Domain

Pick a domain you're interested in and build a RAG system for it:

1. **Tech Documentation**: Framework docs, API references
2. **News & Articles**: Recent articles from your favorite tech blogs  
3. **Academic Papers**: Research papers from arXiv or Google Scholar
4. **Product Information**: E-commerce product descriptions
5. **Company Knowledge**: Internal docs, policies, procedures

Create a list of 10-20 URLs and use our pipeline to build your own knowledge base!

---

## Best Practices for Web Scraping

1. **Respect robots.txt**: Check site's scraping policies
2. **Rate Limiting**: Don't overwhelm servers
3. **User-Agent**: Identify your bot appropriately  
4. **Error Handling**: Sites change - be resilient
5. **Content Quality**: Filter out low-value content
6. **Legal Compliance**: Respect copyright and terms of service

---

## What's Next?

Now that we have a robust data pipeline for gathering and processing content, we have two important next steps:

1. **Create Embeddings**: Convert our text chunks into vector embeddings using OpenAI. In the next section, we'll learn how to transform our carefully crafted chunks into searchable vector representations.

The quality of your chunks directly impacts the quality of your entire RAG system - so don't skip the chunking strategies guide!

<div style="position: relative; padding-bottom: 56.25%; height: 0;"><iframe src="https://www.loom.com/embed/placeholder-data-scraping" frameborder="0" webkitallowfullscreen mozallowfullscreen allowfullscreen style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"></iframe></div>