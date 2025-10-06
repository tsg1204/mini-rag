# Simple RAG Chunking Challenge

A simplified version of the RAG chunking challenge focused on practical constraints that matter in real-world applications.

## The Challenge

Create a chunking solution that handles these real-world constraints:

1. **Token Limits**: Chunks must stay within 512 tokens (configurable)
2. **Complete Words**: Chunks cannot end with incomplete words
3. **Date Tracking**: Each chunk records when it was last stored
4. **Uniform IDs**: Different documents get different, consistent IDs

## Solution Overview

The `SimpleChunker` class provides:

- Token counting using `js-tiktoken` (compatible with OpenAI models)
- Sentence-aware chunking that respects word boundaries
- SHA-256 based document ID generation
- Comprehensive metadata tracking
- Built-in validation functions

## Key Features

### ✅ Token Counting with tiktoken
Uses `js-tiktoken` library to accurately count tokens as OpenAI models do:
```typescript
private countTokens(text: string): number {
  return this.encoding.encode(text).length;
}
```

### ✅ Complete Word Boundaries
Ensures chunks don't end with partial words:
```typescript
private ensureCompleteWords(content: string): string {
  if (/[\s.!?]$/.test(content)) return content;

  const lastSpaceIndex = content.lastIndexOf(' ');
  if (lastSpaceIndex > content.length * 0.8) {
    return content.substring(0, lastSpaceIndex + 1).trim();
  }
  return content;
}
```

### ✅ Date Tracking
Every chunk includes when it was created:
```typescript
metadata: {
  lastStored: new Date(),
  // ... other metadata
}
```

### ✅ Uniform ID Generation
Consistent IDs based on document content and source:
```typescript
// Format: doc-{8-char-hash}-chunk-{index}
id: `${documentId}-chunk-${chunkIndex}`
```

## Files

- `simple-chunking-solution.ts` - Main chunker implementation
- `chunking.test.ts` - Comprehensive test suite
- `demo.ts` - Interactive demonstration
- `sample-react-docs.md` - Large test document
- `package.json` - Dependencies and scripts

## Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run the demo:**
   ```bash
   npm run demo
   ```

3. **Run tests:**
   ```bash
   npm test
   ```

4. **Watch mode for development:**
   ```bash
   npm run test:watch
   ```

## Test Coverage

The test suite validates:

### Token Limits
- ✅ No chunk exceeds 512 tokens
- ✅ Custom token limits respected
- ✅ Accurate token counting

### Word Boundaries
- ✅ No chunks end with incomplete words
- ✅ Handles hyphenated words and contractions
- ✅ Edge case handling

### Date Tracking
- ✅ All chunks have `lastStored` timestamps
- ✅ Timestamps are recent and accurate
- ✅ Proper Date object instances

### Uniform IDs
- ✅ Different documents get different IDs
- ✅ Same documents get same IDs
- ✅ Consistent ID format validation
- ✅ Sequential chunk numbering

### Large Document Handling
- ✅ Processes large documents without errors
- ✅ Maintains metadata consistency
- ✅ Preserves content integrity

### Edge Cases
- ✅ Empty documents
- ✅ Very short documents
- ✅ Special characters and emojis
- ✅ Documents without clear sentence boundaries

## Usage Example

```typescript
import { SimpleChunker } from './simple-chunking-solution';

const chunker = new SimpleChunker();

// Chunk a document
const chunks = chunker.chunkText(
  "Your document content here...",
  "document.md",
  { maxTokens: 512, overlap: 50 }
);

// Validate the results
const validation = chunker.validateChunks(chunks);
console.log(`Valid: ${validation.isValid}`);

// Test ID uniqueness
const idsUnique = chunker.testUniformIds();
console.log(`Unique IDs: ${idsUnique}`);
```

## Key Constraints Verified

1. **Token Limit**: `chunk.metadata.tokenCount <= 512`
2. **Complete Words**: Chunks don't end mid-word
3. **Date Tracking**: `chunk.metadata.lastStored` is a recent Date
4. **Uniform IDs**: `chunk.id` follows format `doc-{hash}-chunk-{index}`

## Why This Approach?

This simplified challenge focuses on constraints that actually matter in production RAG systems:

- **Token limits** prevent embedding model failures
- **Complete words** ensure semantic coherence
- **Date tracking** enables cache invalidation and updates
- **Uniform IDs** allow consistent chunk identification

## Next Steps

Once you've mastered these basics, you can extend the solution with:

- Hierarchical chunking for structured documents
- Semantic similarity-based overlap
- Multi-language tokenization support
- Streaming processing for very large files