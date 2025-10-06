# Chunking Challenge: Handling Large Files and Updates

In real-world RAG applications, you'll often need to deal with large documents and handle content updates. This challenge will introduce you to these important concepts.

---

## The Challenge

You're building a RAG system for a documentation website that needs to process and query technical documentation. These documents:

1. Can be quite large (10,000+ words)
2. Have a hierarchical structure (sections, subsections)
3. Get updated when new versions are released
4. Need good retrieval precision for technical questions

**Your task:** Design a chunking strategy that can:

- Process large files without memory issues
- Maintain semantic integrity of chunks
- Handle document updates in a simple way
- Include basic version tracking

---

## Requirements

Your solution should include:

1. **A chunking algorithm** that handles large files efficiently
2. **A simple chunk identification system** using document ID and chunk position
3. **Basic metadata** including source, timestamp, and version
4. **A simple update strategy** for when documents change

---

## Starting Point: The Problems with Large Files

Let's identify the key challenges with chunking large files:

```typescript
// ❌ Problems with naive approaches for large files:

// Problem 1: Memory overflow
function naiveChunking(filePath: string): Chunk[] {
  // DON'T DO THIS - will crash with large files
  const entireFile = fs.readFileSync(filePath, 'utf8');
  return chunkTextSemantically(entireFile);
}

// Problem 2: Lost document structure
function simpleSplitChunking(filePath: string): Chunk[] {
  const chunks: Chunk[] = [];
  const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
  
  let buffer = '';
  const chunkSize = 1000;
  
  fileStream.on('data', (chunk) => {
    buffer += chunk;
    
    while (buffer.length >= chunkSize) {
      // ❌ BAD: Arbitrary splitting ignores document structure
      chunks.push({
        id: `chunk-${chunks.length}`,
        content: buffer.slice(0, chunkSize),
        metadata: { /* ... */ }
      });
      
      buffer = buffer.slice(chunkSize);
    }
  });
  
  // Handle remaining text...
  
  return chunks;
}

// Problem 3: Simple but inefficient update approach
function updateDocument(docId: string, newContent: string): void {
  // Simple approach: Delete old chunks and create new ones
  deleteChunks(docId);
  const chunks = chunkTextSemantically(newContent);
  storeChunks(docId, chunks);
  
  // While this works, it has drawbacks:
  // 1. All vectors must be re-embedded (expensive)
  // 2. No version history is maintained
  // 3. Can't track which parts actually changed
}
```

---

## Your Implementation Tasks

1. **Create a section-aware chunker** that respects document structure
2. **Design a simple chunk ID system** that includes document ID and position
3. **Add version metadata** to track document updates
4. **Implement a basic update strategy** that handles document changes

---

## Hints to Get Started

Consider these approaches:

1. Process files in manageable sections (like chapters or major headings)
2. Use document structure (headings, paragraphs) to create logical chunks
3. Include document version in chunk metadata
4. Create a simple versioning system for updates

---

## Example: A Section-Aware Chunker

Here's a starting point for your implementation:

```typescript
import * as fs from 'fs';

interface DocumentChunk {
  id: string;          // Chunk identifier (e.g., "doc123-section2-chunk3")
  content: string;     // The chunk content
  metadata: {
    documentId: string;    // Source document ID
    sectionTitle: string;  // Section title this chunk belongs to
    chunkIndex: number;    // Position in document
    version: string;       // Document version (e.g., "1.0")
    timestamp: number;     // When this chunk was created
  };
}

// Your implementation here...
```

---

## Testing Your Solution

Your solution will be evaluated on:

1. How well it handles large files
2. How it preserves document structure
3. How it handles document updates
4. The quality of chunks for retrieval

---

## Submission

Create a file called `large-file-chunking-solution.ts` with your implementation. Include:

1. Your chunking algorithm
2. Your simple update handling approach
3. A test example showing how it works
4. Comments explaining your approach

---

## What We're Looking For

The best solutions will demonstrate:

1. **Understanding** of the challenges with large documents
2. **Practicality** - a solution that works without being overly complex
3. **Structure awareness** - respecting document sections and semantics
4. **Thoughtfulness** about handling updates

Good luck!
