# Chunking Strategies for RAG Systems

Chunking is **the most critical factor** determining RAG performance. Poor chunking leads to irrelevant retrieval, broken context, and confused users. In this section, we'll master the art and science of breaking text into meaningful, searchable chunks.

---

## Why Chunking Matters

Your RAG system is only as good as its chunks. Here's what happens with bad chunking:

- **Broken sentences** confuse embedding models
- **Lost context** when topics are split mid-thought  
- **Poor retrieval** because chunks don't represent complete ideas
- **Frustrated users** getting irrelevant or incomplete answers

**The goal:** Create chunks that are semantically meaningful, appropriately sized, and preserve essential context.

---

## Bad Chunking Examples (What NOT to Do)

Let's start with what NOT to do. These approaches might seem simple, but they destroy the meaning of your content:

```typescript
// ❌ BAD: Character-only splitting breaks sentences
function badCharacterChunking(text: string): string[] {
  return text.match(/.{1,500}/g) || [];
  
  // Results in broken chunks like:
  // "The company announced new feat"
  // "ures including advanced AI c" 
  // "apabilities that will revolutionize..."
}

// ❌ BAD: Fixed word splitting ignores context
function badWordChunking(text: string): string[] {
  const words = text.split(' ');
  const chunks = [];
  for (let i = 0; i < words.length; i += 100) {
    chunks.push(words.slice(i, i + 100).join(' '));
  }
  return chunks;
  
  // Problems:
  // - Splits mid-paragraph, losing topical coherence
  // - Breaks up related concepts arbitrarily
  // - No consideration for sentence boundaries
}

// ❌ BAD: Line-based splitting destroys paragraphs
function badLineChunking(text: string): string[] {
  return text.split('\n').filter(line => line.trim());
  
  // Results in:
  // - Single sentences as chunks (too small)
  // - No context between related ideas
  // - Poor embedding quality
}
```

**Real-world bad chunking example:**
```typescript
// Original text: "React Hooks were introduced in React 16.8. They allow you to use state and other React features without writing a class component. The most commonly used hooks are useState for state management and useEffect for side effects."

// ❌ What bad chunking produces:
const badChunks = [
  "React Hooks were introduced in React 16.8. They allow you to use state and other React features without wri",
  "ting a class component. The most commonly used hooks are useState for state management and useEffect for si",
  "de effects."
];

// Problems:
// 1. "wri" and "ting" are split - meaningless fragments
// 2. "si" and "de effects" are split - breaks the concept
// 3. Each chunk lacks complete context
```

---

## Strategy 1: Semantic Sentence-Aware Chunking (Recommended)

Our improved approach preserves meaning while maintaining optimal size:

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
    chunkType: 'paragraph' | 'section' | 'mixed';
    [key: string]: any;
  };
}

// ✅ GOOD: Semantic sentence-aware chunking
export function chunkTextSemantically(
  text: string, 
  chunkSize: number = 500, 
  overlap: number = 50,
  source: string = 'unknown'
): Chunk[] {
  
  const chunks: Chunk[] = [];
  
  // Step 1: Split into paragraphs first (preserve structure)
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  
  let currentChunk = '';
  let chunkStart = 0;
  let chunkIndex = 0;
  
  for (const paragraph of paragraphs) {
    const sentences = paragraph.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i].trim() + '.';
      
      // Check if adding this sentence would exceed chunk size
      if (currentChunk.length + sentence.length > chunkSize && currentChunk.length > 0) {
        
        // Create chunk with complete sentences only
        const chunk = createChunk(currentChunk.trim(), chunkIndex, chunkStart, source);
        chunks.push(chunk);
        
        // Start new chunk with semantic overlap
        const overlapText = getSemanticOverlap(currentChunk, overlap);
        currentChunk = overlapText ? overlapText + ' ' + sentence : sentence;
        chunkStart = chunk.metadata.endChar - (overlapText?.length || 0);
        chunkIndex++;
        
      } else {
        currentChunk += (currentChunk ? ' ' : '') + sentence;
      }
    }
    
    // Add paragraph break context if we're continuing to next paragraph
    if (currentChunk) {
      currentChunk += '\n\n';
    }
  }
  
  // Add final chunk if it has content
  if (currentChunk.trim()) {
    chunks.push(createChunk(currentChunk.trim(), chunkIndex, chunkStart, source));
  }
  
  // Update metadata
  chunks.forEach(chunk => {
    chunk.metadata.totalChunks = chunks.length;
  });
  
  return chunks;
}

function createChunk(content: string, index: number, start: number, source: string): Chunk {
  return {
    id: `${source}-chunk-${index}`,
    content,
    metadata: {
      source,
      chunkIndex: index,
      totalChunks: 0, // Updated later
      startChar: start,
      endChar: start + content.length,
      chunkType: content.includes('\n\n') ? 'mixed' : 'paragraph'
    }
  };
}

// Smart overlap that preserves sentence boundaries
function getSemanticOverlap(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  
  // Find the last complete sentence within maxLength
  const lastSentenceEnd = text.lastIndexOf('.', maxLength);
  if (lastSentenceEnd > maxLength * 0.5) { // At least 50% of maxLength
    return text.substring(lastSentenceEnd + 1).trim();
  }
  
  // Fallback to word boundary
  return getLastWords(text, maxLength);
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

**Why this works better:**
- ✅ Preserves complete sentences
- ✅ Maintains paragraph structure  
- ✅ Smart overlap preserves context
- ✅ Metadata tracks chunk relationships
- ✅ Each chunk is semantically meaningful

---

## Strategy 2: Hierarchical Document Chunking

For structured documents with headers, preserve the document hierarchy:

```typescript
// lib/hierarchical-chunking.ts
interface DocumentSection {
  title: string;
  content: string;
  level: number; // h1=1, h2=2, etc.
  children: DocumentSection[];
}

export function chunkHierarchically(
  html: string,
  source: string
): Chunk[] {
  const sections = parseDocumentStructure(html);
  return sectionsToChunks(sections, source);
}

function parseDocumentStructure(html: string): DocumentSection[] {
  const $ = require('cheerio').load(html);
  const sections: DocumentSection[] = [];
  
  $('h1, h2, h3, h4, h5, h6').each((_, element) => {
    const $el = $(element);
    const level = parseInt(element.tagName.charAt(1));
    const title = $el.text().trim();
    
    // Get content until next heading of same or higher level
    const content = getContentUntilNextHeading($el, level);
    
    sections.push({
      title,
      content,
      level,
      children: []
    });
  });
  
  return sections;
}

function sectionsToChunks(sections: DocumentSection[], source: string): Chunk[] {
  const chunks: Chunk[] = [];
  
  sections.forEach((section, index) => {
    // Create context-rich content with hierarchy
    const contextualContent = `# ${section.title}\n\n${section.content}`;
    
    if (contextualContent.length > 800) {
      // Split large sections but keep header context
      const subChunks = chunkTextSemantically(section.content, 600, 50, source);
      subChunks.forEach((chunk, subIndex) => {
        chunk.content = `# ${section.title}\n\n${chunk.content}`;
        chunk.id = `${source}-section-${index}-${subIndex}`;
        chunk.metadata.sectionTitle = section.title;
        chunk.metadata.sectionLevel = section.level;
        chunks.push(chunk);
      });
    } else {
      chunks.push({
        id: `${source}-section-${index}`,
        content: contextualContent,
        metadata: {
          source,
          chunkIndex: index,
          totalChunks: 0,
          startChar: 0,
          endChar: contextualContent.length,
          chunkType: 'section',
          sectionTitle: section.title,
          sectionLevel: section.level
        }
      });
    }
  });
  
  return chunks;
}

function getContentUntilNextHeading($element: any, currentLevel: number): string {
  let content = '';
  let $next = $element.next();
  
  while ($next.length) {
    const tagName = $next.prop('tagName');
    
    // If we hit another heading of same or higher level, stop
    if (tagName && tagName.match(/^H[1-6]$/)) {
      const nextLevel = parseInt(tagName.charAt(1));
      if (nextLevel <= currentLevel) {
        break;
      }
    }
    
    content += $next.text() + '\n';
    $next = $next.next();
  }
  
  return content.trim();
}
```

---

## Strategy 3: Context-Preserving Overlap

Overlap isn't just about repetition - it's about maintaining context between chunks:

```typescript
// Advanced overlap strategies
export function createContextualOverlap(
  previousChunk: string,
  nextSentence: string,
  overlapSize: number
): string {
  
  // Strategy 1: Last complete sentence + keywords
  const sentences = previousChunk.split(/[.!?]+/).filter(s => s.trim());
  const lastSentence = sentences[sentences.length - 1]?.trim() + '.';
  
  // Extract key terms from the previous chunk for context
  const keyTerms = extractKeyTerms(previousChunk);
  const contextualKeywords = keyTerms.slice(0, 3).join(', ');
  
  if (lastSentence && lastSentence.length < overlapSize) {
    return `${lastSentence} [Context: ${contextualKeywords}]`;
  }
  
  // Strategy 2: Semantic summary overlap
  return createSemanticSummary(previousChunk, overlapSize);
}

function extractKeyTerms(text: string): string[] {
  // Simple keyword extraction (in production, use NLP libraries)
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3);
    
  const frequency: Record<string, number> = {};
  words.forEach(word => {
    frequency[word] = (frequency[word] || 0) + 1;
  });
  
  return Object.entries(frequency)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 5)
    .map(([word]) => word);
}

function createSemanticSummary(text: string, maxLength: number): string {
  // Extract the core concept from the previous chunk
  const sentences = text.split(/[.!?]+/).filter(s => s.trim());
  const firstSentence = sentences[0]?.trim() + '.';
  const lastSentence = sentences[sentences.length - 1]?.trim() + '.';
  
  const summary = `${firstSentence} ... ${lastSentence}`;
  
  return summary.length <= maxLength ? summary : firstSentence;
}
```

---

## Testing Chunk Quality

Always validate your chunking strategy with systematic tests:

```typescript
// tests/chunking-quality.test.ts
export function validateChunkQuality(chunks: Chunk[]): ChunkQualityReport {
  const report: ChunkQualityReport = {
    totalChunks: chunks.length,
    issues: [],
    qualityScore: 0,
    recommendations: []
  };

  chunks.forEach((chunk, index) => {
    const content = chunk.content.trim();
    
    // Test 1: Sentence boundary integrity
    const startsWithLowercase = /^[a-z]/.test(content);
    const endsIncomplete = !content.match(/[.!?]$/) && content.length > 50;
    
    if (startsWithLowercase) {
      report.issues.push({
        chunkIndex: index,
        type: 'broken_start',
        message: `Starts with lowercase: "${content.substring(0, 50)}..."`
      });
    }
    
    if (endsIncomplete) {
      report.issues.push({
        chunkIndex: index,
        type: 'incomplete_end',
        message: `Ends incomplete: "...${content.substring(content.length - 50)}"`
      });
    }
    
    // Test 2: Size optimization
    if (content.length < 100) {
      report.issues.push({
        chunkIndex: index,
        type: 'too_short',
        message: `Only ${content.length} characters - may lack context`
      });
    }
    
    if (content.length > 1000) {
      report.issues.push({
        chunkIndex: index,
        type: 'too_long', 
        message: `${content.length} characters - may hurt retrieval precision`
      });
    }
    
    // Test 3: Semantic coherence
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    if (sentences.length === 1 && content.length > 300) {
      report.issues.push({
        chunkIndex: index,
        type: 'single_long_sentence',
        message: `One very long sentence - may lack coherence`
      });
    }
    
    // Test 4: Overlap quality
    if (index > 0) {
      const overlapQuality = measureOverlapQuality(chunks[index - 1], chunk);
      if (overlapQuality < 0.3) {
        report.issues.push({
          chunkIndex: index,
          type: 'poor_overlap',
          message: `Low overlap quality with previous chunk`
        });
      }
    }
  });
  
  // Calculate quality score
  const issueWeight = {
    broken_start: 10,
    incomplete_end: 10,
    too_short: 5,
    too_long: 3,
    single_long_sentence: 2,
    poor_overlap: 5
  };
  
  const totalPenalty = report.issues.reduce((sum, issue) => 
    sum + (issueWeight[issue.type] || 1), 0
  );
  
  report.qualityScore = Math.max(0, 100 - (totalPenalty / chunks.length));
  
  // Generate recommendations
  if (report.qualityScore < 70) {
    report.recommendations.push("Consider using semantic sentence-aware chunking");
  }
  if (report.issues.some(i => i.type === 'broken_start' || i.type === 'incomplete_end')) {
    report.recommendations.push("Ensure chunks preserve sentence boundaries");
  }
  
  return report;
}

interface ChunkQualityReport {
  totalChunks: number;
  issues: Array<{
    chunkIndex: number;
    type: string;
    message: string;
  }>;
  qualityScore: number;
  recommendations: string[];
}

function measureOverlapQuality(chunk1: Chunk, chunk2: Chunk): number {
  // Simple overlap quality measure based on shared words
  const words1 = new Set(chunk1.content.toLowerCase().split(/\s+/));
  const words2 = new Set(chunk2.content.toLowerCase().split(/\s+/));
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}

// Example usage in your pipeline
export function testChunkingPipeline() {
  const testText = `
    React Hooks were introduced in React 16.8. They allow you to use state and other React features without writing a class component.
    
    The most commonly used hooks are useState for state management and useEffect for side effects. Hooks must be called at the top level of React functions.
    
    Custom hooks are JavaScript functions whose names start with "use" and that may call other hooks. They let you extract component logic into reusable functions.
  `;
  
  const chunks = chunkTextSemantically(testText, 500, 50, 'test-doc');
  const report = validateChunkQuality(chunks);
  
  console.log(`Quality Score: ${report.qualityScore}/100`);
  console.log(`Issues Found: ${report.issues.length}`);
  
  if (report.issues.length > 0) {
    console.log('\nIssues:');
    report.issues.forEach(issue => {
      console.log(`- Chunk ${issue.chunkIndex}: ${issue.message}`);
    });
  }
  
  if (report.recommendations.length > 0) {
    console.log('\nRecommendations:');
    report.recommendations.forEach(rec => console.log(`- ${rec}`));
  }
}
```

---

## Good vs Bad Chunk Examples

### ✅ Good Chunks

```typescript
const goodChunks = [
  {
    content: `React Hooks were introduced in React 16.8. They allow you to use state and other React features without writing a class component. The most commonly used hooks are useState for state management and useEffect for side effects.`,
    why: "Complete sentences, coherent topic, appropriate length"
  },
  {
    content: `# Authentication Setup\n\nTo configure authentication in your Next.js app, you'll need to install and configure NextAuth.js. This library provides a complete authentication solution with support for multiple providers.`,
    why: "Includes section header for context, complete instructions"
  }
];
```

### ❌ Bad Chunks  

```typescript
const badChunks = [
  {
    content: `ooks were introduced in React 16.8. They allow you to use state and other React features without writing a class compon`,
    why: "Missing start, cut off mid-word, no complete thought"
  },
  {
    content: `useState`,
    why: "Too short, no context, meaningless alone"
  },
  {
    content: `The authentication system uses JSON Web Tokens for session management and provides middleware for route protection and integrates with multiple OAuth providers including Google Facebook GitHub and supports custom authentication flows with extensive configuration options for security and performance optimization.`,
    why: "One massive run-on sentence, hard to parse"
  }
];
```

---

## Chunking Best Practices Summary

1. **Preserve Sentence Boundaries** - Never break sentences mid-word
2. **Maintain Semantic Cohesion** - Keep related concepts together  
3. **Use Smart Overlap** - Preserve context between chunks
4. **Consider Document Structure** - Respect headings and sections
5. **Test Your Strategy** - Validate chunk quality systematically
6. **Size Appropriately** - 300-800 characters is usually optimal
7. **Add Rich Metadata** - Track source, position, and type information

---

## Exercise: Implement and Test Your Chunking

1. Choose a sample document from your domain
2. Implement both basic and semantic chunking
3. Run the quality validation tests
4. Compare retrieval performance between strategies
5. Iterate based on your specific content type

---

## Advanced Challenge: Large File Chunking

Ready to test your chunking skills on a more complex scenario? Check out our [Advanced Chunking Challenge](./3-advanced-chunking-challenge.md) where you'll learn how to:

- Process extremely large files efficiently
- Maintain semantic integrity across chunks
- Implement update strategies for changing content
- Track relationships between chunks

This challenge will prepare you for real-world RAG applications where documents are massive and frequently updated!

---

## What's Next?

Now that we have high-quality chunks, the next step is to convert them into vector embeddings that capture their semantic meaning. In the next section, we'll learn how to use OpenAI's embedding models to transform our carefully crafted chunks into vectors that our RAG system can search efficiently.

The quality of your chunks directly impacts the quality of your embeddings - and ultimately, the quality of your RAG system's responses!

<div style="position: relative; padding-bottom: 56.25%; height: 0;"><iframe src="https://www.loom.com/embed/placeholder-chunking-strategies" frameborder="0" webkitallowfullscreen mozallowfullscreen allowfullscreen style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"></iframe></div>