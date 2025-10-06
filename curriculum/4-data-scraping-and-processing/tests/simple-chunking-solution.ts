import { getEncoding } from 'js-tiktoken';
import crypto from 'crypto';

interface SimpleChunk {
  id: string;
  content: string;
  metadata: {
    documentId: string;
    chunkIndex: number;
    tokenCount: number;
    lastStored: Date;
    source: string;
  };
}

interface ChunkingOptions {
  maxTokens?: number;
  overlap?: number;
  documentId?: string;
}

/**
 * Simple chunking solution with practical constraints:
 * - Chunks have date when last stored
 * - Chunks stay within 512 token limit (configurable)
 * - Chunks don't end with incomplete words
 * - Chunks have uniform IDs based on document hash + position
 */
export class SimpleChunker {
  private encoding = getEncoding('cl100k_base'); // GPT-3.5/4 encoding

  /**
   * Chunk text with practical constraints
   */
  public chunkText(
    text: string,
    source: string,
    options: ChunkingOptions = {}
  ): SimpleChunk[] {
    const {
      maxTokens = 512,
      overlap = 50,
      documentId = this.generateDocumentId(text, source)
    } = options;

    const chunks: SimpleChunk[] = [];
    const sentences = this.splitIntoSentences(text);

    let currentChunk = '';
    let chunkIndex = 0;

    for (const sentence of sentences) {
      const testChunk = currentChunk + (currentChunk ? ' ' : '') + sentence;
      const tokenCount = this.countTokens(testChunk);

      // If adding this sentence would exceed token limit, create a chunk
      if (tokenCount > maxTokens && currentChunk.length > 0) {
        chunks.push(this.createChunk(
          currentChunk.trim(),
          documentId,
          chunkIndex,
          source
        ));

        // Start new chunk with overlap if possible
        const overlapText = this.createOverlap(currentChunk, overlap);
        currentChunk = overlapText ? overlapText + ' ' + sentence : sentence;
        chunkIndex++;
      } else {
        currentChunk = testChunk;
      }
    }

    // Add the final chunk if it has content
    if (currentChunk.trim()) {
      chunks.push(this.createChunk(
        currentChunk.trim(),
        documentId,
        chunkIndex,
        source
      ));
    }

    return chunks;
  }

  /**
   * Split text into sentences, preserving complete sentences
   */
  private splitIntoSentences(text: string): string[] {
    // Simple sentence splitting - handles most cases
    return text
      .split(/[.!?]+/)
      .map(sentence => sentence.trim())
      .filter(sentence => sentence.length > 0)
      .map(sentence => sentence + '.'); // Add back period
  }

  /**
   * Count tokens using tiktoken
   */
  private countTokens(text: string): number {
    return this.encoding.encode(text).length;
  }

  /**
   * Create overlap text that preserves word boundaries
   */
  private createOverlap(text: string, maxTokens: number): string {
    if (maxTokens === 0) return '';

    const words = text.split(' ');
    let overlap = '';

    // Take words from the end until we approach token limit
    for (let i = words.length - 1; i >= 0; i--) {
      const testOverlap = words.slice(i).join(' ');
      if (this.countTokens(testOverlap) <= maxTokens) {
        overlap = testOverlap;
        break;
      }
    }

    return overlap;
  }

  /**
   * Generate consistent document ID based on content and source
   */
  private generateDocumentId(text: string, source: string): string {
    const hash = crypto
      .createHash('sha256')
      .update(text + source)
      .digest('hex')
      .substring(0, 8);
    return `doc-${hash}`;
  }

  /**
   * Create a chunk with all required metadata
   */
  private createChunk(
    content: string,
    documentId: string,
    chunkIndex: number,
    source: string
  ): SimpleChunk {
    // Ensure chunk doesn't end with incomplete word
    const cleanContent = this.ensureCompleteWords(content);

    return {
      id: `${documentId}-chunk-${chunkIndex}`,
      content: cleanContent,
      metadata: {
        documentId,
        chunkIndex,
        tokenCount: this.countTokens(cleanContent),
        lastStored: new Date(),
        source
      }
    };
  }

  /**
   * Ensure chunk doesn't end with incomplete words
   */
  private ensureCompleteWords(content: string): string {
    // If content ends with a word boundary, return as-is
    if (/[\s.!?]$/.test(content)) {
      return content;
    }

    // Find the last word boundary and trim there
    const lastSpaceIndex = content.lastIndexOf(' ');
    if (lastSpaceIndex > content.length * 0.8) { // Only trim if we don't lose too much
      return content.substring(0, lastSpaceIndex + 1).trim();
    }

    return content; // Return original if trimming would remove too much
  }

  /**
   * Validate that chunks meet all constraints
   */
  public validateChunks(chunks: SimpleChunk[], maxTokens: number = 512): {
    isValid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    for (const chunk of chunks) {
      // Check token limit
      if (chunk.metadata.tokenCount > maxTokens) {
        issues.push(`Chunk ${chunk.id} exceeds token limit: ${chunk.metadata.tokenCount} > ${maxTokens}`);
      }

      // Check for incomplete words (ends with alphabetic character not followed by punctuation)
      if (/[a-zA-Z]$/.test(chunk.content) && !chunk.content.endsWith('.')) {
        issues.push(`Chunk ${chunk.id} ends with incomplete word: "${chunk.content.slice(-20)}"`);
      }

      // Check that lastStored date exists and is recent
      const hoursSinceStored = (Date.now() - chunk.metadata.lastStored.getTime()) / (1000 * 60 * 60);
      if (hoursSinceStored > 1) {
        issues.push(`Chunk ${chunk.id} lastStored date seems old: ${chunk.metadata.lastStored}`);
      }

      // Check ID format
      if (!chunk.id.match(/^doc-[a-f0-9]{8}-chunk-\d+$/)) {
        issues.push(`Chunk ${chunk.id} has invalid ID format`);
      }
    }

    return {
      isValid: issues.length === 0,
      issues
    };
  }

  /**
   * Test that different documents get different IDs
   */
  public testUniformIds(): boolean {
    const doc1 = "This is document one with some content.";
    const doc2 = "This is document two with different content.";

    const chunks1 = this.chunkText(doc1, "test1.md");
    const chunks2 = this.chunkText(doc2, "test2.md");

    // Document IDs should be different
    const docId1 = chunks1[0]?.metadata.documentId;
    const docId2 = chunks2[0]?.metadata.documentId;

    return docId1 !== docId2 && docId1 && docId2;
  }
}

// Example usage and testing
export function demonstrateChunking() {
  const chunker = new SimpleChunker();

  const sampleText = `
    React is a JavaScript library for building user interfaces. It was developed by Facebook and is now maintained by Meta.
    React uses a component-based architecture where you build encapsulated components that manage their own state.
    Components can be composed to create complex UIs. React also uses a virtual DOM to efficiently update the actual DOM.
    The virtual DOM is a lightweight copy of the real DOM kept in memory. When state changes, React compares the virtual DOM
    with the previous version and only updates the parts that have changed. This process is called reconciliation.
  `;

  const chunks = chunker.chunkText(sampleText, "react-intro.md");
  const validation = chunker.validateChunks(chunks);
  const idsValid = chunker.testUniformIds();

  console.log(`Created ${chunks.length} chunks`);
  console.log(`Validation passed: ${validation.isValid}`);
  console.log(`Uniform ID test passed: ${idsValid}`);

  if (validation.issues.length > 0) {
    console.log("Issues found:", validation.issues);
  }

  chunks.forEach((chunk, index) => {
    console.log(`\nChunk ${index + 1}:`);
    console.log(`ID: ${chunk.id}`);
    console.log(`Tokens: ${chunk.metadata.tokenCount}`);
    console.log(`Last stored: ${chunk.metadata.lastStored.toISOString()}`);
    console.log(`Content: ${chunk.content.substring(0, 100)}...`);
  });

  return { chunks, validation, idsValid };
}