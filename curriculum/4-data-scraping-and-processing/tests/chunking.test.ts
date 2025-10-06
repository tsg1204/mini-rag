import * as fs from 'fs';
import { SimpleChunker } from './simple-chunking-solution';

describe('SimpleChunker', () => {
  let chunker: SimpleChunker;
  let largeDocument: string;

  beforeAll(() => {
    chunker = new SimpleChunker();

    // Load the large test document
    try {
      largeDocument = fs.readFileSync(
        '/Users/brianjenney/Desktop/apps/parsity-curriculum/15-rag-applications/4-data-scraping-and-processing/tests/sample-react-docs.md',
        'utf8'
      );
    } catch (error) {
      largeDocument = `
        # Fallback React Documentation

        React is a JavaScript library for building user interfaces. It was developed by Facebook and is now maintained by Meta.
        React uses a component-based architecture where you build encapsulated components that manage their own state.
        Components can be composed to create complex UIs. React also uses a virtual DOM to efficiently update the actual DOM.
        The virtual DOM is a lightweight copy of the real DOM kept in memory. When state changes, React compares the virtual DOM
        with the previous version and only updates the parts that have changed. This process is called reconciliation.

        ## Creating Components

        You can create React components as functions or classes. Function components are simpler and are the recommended approach.
        Here's an example of a simple function component that renders a greeting message.

        ## State Management

        React provides the useState hook for managing component state. State allows components to remember information between renders.
        When state changes, React will re-render the component with the new state values.

        ## Event Handling

        React components can handle events like clicks, form submissions, and keyboard input. Event handlers are functions that are
        called when specific events occur. You pass event handlers as props to elements.
      `.repeat(10); // Make it larger for testing
    }
  });

  describe('Token Limits', () => {
    test('should not exceed 512 token limit', () => {
      const chunks = chunker.chunkText(largeDocument, 'test-doc.md', { maxTokens: 512 });

      chunks.forEach(chunk => {
        expect(chunk.metadata.tokenCount).toBeLessThanOrEqual(512);
      });
    });

    test('should respect custom token limits', () => {
      const customLimit = 256;
      const chunks = chunker.chunkText(largeDocument, 'test-doc.md', { maxTokens: customLimit });

      chunks.forEach(chunk => {
        expect(chunk.metadata.tokenCount).toBeLessThanOrEqual(customLimit);
      });
    });

    test('should have accurate token counts', () => {
      const chunks = chunker.chunkText("Hello world! This is a test.", 'test.md');

      chunks.forEach(chunk => {
        // Token count should be positive and reasonable
        expect(chunk.metadata.tokenCount).toBeGreaterThan(0);
        expect(chunk.metadata.tokenCount).toBeLessThan(chunk.content.length); // Sanity check
      });
    });
  });

  describe('Complete Word Boundaries', () => {
    test('should not end with incomplete words', () => {
      const chunks = chunker.chunkText(largeDocument, 'test-doc.md');

      chunks.forEach(chunk => {
        // Should not end with a partial word (alphabetic character without punctuation)
        if (chunk.content.length > 0) {
          const lastChar = chunk.content.charAt(chunk.content.length - 1);
          if (/[a-zA-Z]/.test(lastChar)) {
            // If it ends with a letter, the previous character should be whitespace or punctuation
            const secondLastChar = chunk.content.charAt(chunk.content.length - 2);
            expect(/[\s.!?]/.test(secondLastChar) || chunk.content.length === 1).toBe(true);
          }
        }
      });
    });

    test('should handle edge cases with word boundaries', () => {
      const testText = "This is a test with-hyphenated words and contractions like don't.";
      const chunks = chunker.chunkText(testText, 'test.md', { maxTokens: 20 });

      chunks.forEach(chunk => {
        // Should not end mid-word
        expect(chunk.content).not.toMatch(/[a-zA-Z]-$/);
        expect(chunk.content).not.toMatch(/[a-zA-Z]'$/);
      });
    });
  });

  describe('Date Tracking', () => {
    test('should have lastStored date for each chunk', () => {
      const chunks = chunker.chunkText("Test content for date tracking.", 'test.md');

      chunks.forEach(chunk => {
        expect(chunk.metadata.lastStored).toBeInstanceOf(Date);
        expect(chunk.metadata.lastStored.getTime()).toBeLessThanOrEqual(Date.now());
        expect(chunk.metadata.lastStored.getTime()).toBeGreaterThan(Date.now() - 5000); // Within last 5 seconds
      });
    });

    test('should have recent timestamps', () => {
      const before = new Date();
      const chunks = chunker.chunkText("Test content.", 'test.md');
      const after = new Date();

      chunks.forEach(chunk => {
        expect(chunk.metadata.lastStored.getTime()).toBeGreaterThanOrEqual(before.getTime());
        expect(chunk.metadata.lastStored.getTime()).toBeLessThanOrEqual(after.getTime());
      });
    });
  });

  describe('Uniform ID Generation', () => {
    test('should generate different IDs for different documents', () => {
      const doc1 = "This is the first document with unique content.";
      const doc2 = "This is the second document with different content.";

      const chunks1 = chunker.chunkText(doc1, 'doc1.md');
      const chunks2 = chunker.chunkText(doc2, 'doc2.md');

      expect(chunks1[0]?.metadata.documentId).not.toBe(chunks2[0]?.metadata.documentId);
      expect(chunks1[0]?.id).not.toBe(chunks2[0]?.id);
    });

    test('should generate same IDs for identical documents', () => {
      const doc = "This is identical content for testing.";

      const chunks1 = chunker.chunkText(doc, 'same-source.md');
      const chunks2 = chunker.chunkText(doc, 'same-source.md');

      expect(chunks1[0]?.metadata.documentId).toBe(chunks2[0]?.metadata.documentId);
    });

    test('should have consistent ID format', () => {
      const chunks = chunker.chunkText("Test content for ID format checking.", 'test.md');

      chunks.forEach(chunk => {
        // ID should match pattern: doc-{8 hex chars}-chunk-{number}
        expect(chunk.id).toMatch(/^doc-[a-f0-9]{8}-chunk-\d+$/);
        expect(chunk.metadata.documentId).toMatch(/^doc-[a-f0-9]{8}$/);
      });
    });

    test('should have sequential chunk indices', () => {
      const chunks = chunker.chunkText(largeDocument, 'test.md');

      chunks.forEach((chunk, index) => {
        expect(chunk.metadata.chunkIndex).toBe(index);
        expect(chunk.id).toContain(`-chunk-${index}`);
      });
    });
  });

  describe('Validation Function', () => {
    test('should validate good chunks', () => {
      const chunks = chunker.chunkText("This is a well-formed document for testing.", 'test.md');
      const validation = chunker.validateChunks(chunks);

      expect(validation.isValid).toBe(true);
      expect(validation.issues).toHaveLength(0);
    });

    test('should detect token limit violations', () => {
      // Create chunks with normal limit, then validate with lower limit
      const chunks = chunker.chunkText(largeDocument, 'test.md', { maxTokens: 512 });
      const validation = chunker.validateChunks(chunks, 100); // Much lower limit

      expect(validation.isValid).toBe(false);
      expect(validation.issues.some(issue => issue.includes('exceeds token limit'))).toBe(true);
    });

    test('should detect invalid ID formats', () => {
      const chunks = chunker.chunkText("Test content.", 'test.md');

      // Corrupt the ID format
      if (chunks[0]) {
        chunks[0].id = 'invalid-id-format';
      }

      const validation = chunker.validateChunks(chunks);
      expect(validation.isValid).toBe(false);
      expect(validation.issues.some(issue => issue.includes('invalid ID format'))).toBe(true);
    });
  });

  describe('Large Document Handling', () => {
    test('should handle large documents without errors', () => {
      expect(() => {
        const chunks = chunker.chunkText(largeDocument, 'large-doc.md');
        expect(chunks.length).toBeGreaterThan(1);
      }).not.toThrow();
    });

    test('should maintain metadata across all chunks', () => {
      const chunks = chunker.chunkText(largeDocument, 'large-doc.md');

      chunks.forEach(chunk => {
        expect(chunk.metadata.documentId).toBeTruthy();
        expect(chunk.metadata.source).toBe('large-doc.md');
        expect(chunk.metadata.tokenCount).toBeGreaterThan(0);
        expect(chunk.metadata.lastStored).toBeInstanceOf(Date);
      });
    });

    test('should preserve content across chunking', () => {
      const originalLength = largeDocument.length;
      const chunks = chunker.chunkText(largeDocument, 'test.md');

      const totalChunkedLength = chunks.reduce((total, chunk) => total + chunk.content.length, 0);

      // Should preserve most content (allowing for some overlap and trimming)
      expect(totalChunkedLength).toBeGreaterThan(originalLength * 0.8);
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty documents', () => {
      const chunks = chunker.chunkText('', 'empty.md');
      expect(chunks).toHaveLength(0);
    });

    test('should handle very short documents', () => {
      const chunks = chunker.chunkText('Short.', 'short.md');
      expect(chunks).toHaveLength(1);
      expect(chunks[0]?.content).toBe('Short.');
    });

    test('should handle documents with no sentences', () => {
      const chunks = chunker.chunkText('just words without punctuation', 'no-sentences.md');
      expect(chunks.length).toBeGreaterThanOrEqual(1);
    });

    test('should handle special characters', () => {
      const textWithSpecialChars = "This has émojis 🚀 and spéciál characters! Wörks?";
      const chunks = chunker.chunkText(textWithSpecialChars, 'special.md');

      expect(chunks.length).toBeGreaterThanOrEqual(1);
      expect(chunks[0]?.content).toContain('🚀');
      expect(chunks[0]?.content).toContain('émojis');
    });
  });

  describe('Built-in Test Function', () => {
    test('should pass its own uniform ID test', () => {
      const result = chunker.testUniformIds();
      expect(result).toBe(true);
    });
  });
});