# Large File Chunking Solution

This is a reference solution for the chunking challenge. It demonstrates how to handle large files efficiently while maintaining semantic integrity and supporting basic document updates.

---

## Solution Overview

Our solution addresses the key challenges with a straightforward approach:

1. **Section-Aware Processing** - Process files by sections to avoid memory issues
2. **Structure Preservation** - Respect document headings and paragraphs
3. **Simple Versioning** - Track document versions in chunk metadata
4. **Basic Update Strategy** - Handle document changes with version tracking

---

## Implementation

### 1. Section-Aware Document Processor

```typescript
import * as fs from 'fs';
import * as readline from 'readline';

// Process large files by sections
export async function processLargeDocument(
  filePath: string,
  documentId: string,
  version: string = '1.0'
): Promise<DocumentChunk[]> {
  // Create a readable stream from the file
  const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
  
  // Create a line reader interface
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  const chunks: DocumentChunk[] = [];
  let currentSection: Section = {
    title: 'Introduction',
    content: '',
    level: 0
  };
  
  let sections: Section[] = [];
  let lineNumber = 0;
  let buffer = '';
  
  // Process the document line by line
  for await (const line of rl) {
    lineNumber++;
    
    // Detect section headers (e.g., # Title, ## Subtitle)
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
    
    if (headerMatch) {
      // If we found a header, complete the previous section
      if (buffer.trim()) {
        currentSection.content = buffer.trim();
        sections.push(currentSection);
        buffer = '';
      }
      
      // Start a new section
      const level = headerMatch[1].length;
      const title = headerMatch[2].trim();
      
      currentSection = {
        title,
        content: '',
        level
      };
    } else {
      // Add the line to the current buffer
      buffer += line + '\n';
    }
  }
  
  // Handle the last section
  if (buffer.trim()) {
    currentSection.content = buffer.trim();
    sections.push(currentSection);
  }
  
  // Convert sections to chunks
  let chunkIndex = 0;
  for (const section of sections) {
    const sectionChunks = createChunksFromSection(
      section, 
      documentId, 
      version, 
      chunkIndex
    );
    
    chunks.push(...sectionChunks);
    chunkIndex += sectionChunks.length;
  }
  
  return chunks;
}

interface Section {
  title: string;
  content: string;
  level: number;
}
```

### 2. Structure-Preserving Chunking

```typescript
// Convert a document section to chunks while preserving structure
function createChunksFromSection(
  section: Section, 
  documentId: string,
  version: string,
  startIndex: number
): DocumentChunk[] {
  const chunks: DocumentChunk[] = [];
  const content = section.content;
  
  // If section is small enough, keep it as a single chunk
  if (content.length <= 1000) {
    chunks.push(createChunk(
      section.title,
      content,
      documentId,
      version,
      startIndex
    ));
    return chunks;
  }
  
  // Split larger sections into semantic chunks by paragraphs
  const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim());
  let currentChunk = '';
  let chunkParagraphs: string[] = [];
  let chunkIndex = startIndex;
  
  for (const paragraph of paragraphs) {
    // If adding this paragraph would make the chunk too large
    if (currentChunk.length + paragraph.length > 1000 && currentChunk) {
      // Create a chunk with the content so far
      chunks.push(createChunk(
        section.title,
        currentChunk,
        documentId,
        version,
        chunkIndex
      ));
      
      chunkIndex++;
      currentChunk = '';
      chunkParagraphs = [];
    }
    
    chunkParagraphs.push(paragraph);
    currentChunk = chunkParagraphs.join('\n\n');
  }
  
  // Add the final chunk if there's content left
  if (currentChunk) {
    chunks.push(createChunk(
      section.title,
      currentChunk,
      documentId,
      version,
      chunkIndex
    ));
  }
  
  return chunks;
}

function createChunk(
  sectionTitle: string,
  content: string,
  documentId: string,
  version: string,
  chunkIndex: number
): DocumentChunk {
  // Add section title as context if it's not already included
  const titlePrefix = `# ${sectionTitle}\n\n`;
  const fullContent = content.includes(sectionTitle) ? 
    content : titlePrefix + content;
    
  // Create a simple but descriptive ID
  const id = `${documentId}-v${version}-chunk${chunkIndex}`;
  
  return {
    id,
    content: fullContent,
    metadata: {
      documentId,
      sectionTitle,
      chunkIndex,
      version,
      timestamp: Date.now()
    }
  };
}

interface DocumentChunk {
  id: string;
  content: string;
  metadata: {
    documentId: string;
    sectionTitle: string;
    chunkIndex: number;
    version: string;
    timestamp: number;
  };
}
```

### 3. Simple Update Strategy

```typescript
// Basic document update system
export async function updateDocument(
  documentId: string,
  newContent: string,
  previousVersion: string,
  chunkStore: ChunkStore
): Promise<UpdateResult> {
  // 1. Generate a new version number
  const newVersion = incrementVersion(previousVersion);
  
  // 2. Process the updated document with the new version
  const tempFilePath = `/tmp/${documentId}-${newVersion}.md`;
  fs.writeFileSync(tempFilePath, newContent);
  
  const newChunks = await processLargeDocument(
    tempFilePath,
    documentId,
    newVersion
  );
  
  // 3. Store the new chunks
  await chunkStore.storeChunks(newChunks);
  
  // 4. Mark old chunks as previous version (but don't delete them)
  const oldChunks = await chunkStore.getChunksByDocumentId(documentId, previousVersion);
  await chunkStore.markChunksAsPreviousVersion(oldChunks.map(c => c.id));
  
  // 5. Clean up temp file
  fs.unlinkSync(tempFilePath);
  
  return {
    documentId,
    previousVersion,
    newVersion,
    chunkCount: newChunks.length
  };
}

function incrementVersion(version: string): string {
  const parts = version.split('.');
  const lastPart = parseInt(parts[parts.length - 1]) + 1;
  parts[parts.length - 1] = lastPart.toString();
  return parts.join('.');
}

interface UpdateResult {
  documentId: string;
  previousVersion: string;
  newVersion: string;
  chunkCount: number;
}

interface ChunkStore {
  storeChunks(chunks: DocumentChunk[]): Promise<void>;
  getChunksByDocumentId(documentId: string, version?: string): Promise<DocumentChunk[]>;
  markChunksAsPreviousVersion(chunkIds: string[]): Promise<void>;
}
```

### 4. Example Implementation of ChunkStore

```typescript
// A simple in-memory chunk store for demonstration
export class InMemoryChunkStore implements ChunkStore {
  private chunks: DocumentChunk[] = [];
  private activeChunks: Set<string> = new Set();
  
  async storeChunks(chunks: DocumentChunk[]): Promise<void> {
    for (const chunk of chunks) {
      this.chunks.push(chunk);
      this.activeChunks.add(chunk.id);
    }
  }
  
  async getChunksByDocumentId(
    documentId: string, 
    version?: string
  ): Promise<DocumentChunk[]> {
    return this.chunks.filter(chunk => {
      const versionMatch = version ? chunk.metadata.version === version : true;
      return chunk.metadata.documentId === documentId && versionMatch;
    });
  }
  
  async markChunksAsPreviousVersion(chunkIds: string[]): Promise<void> {
    for (const id of chunkIds) {
      this.activeChunks.delete(id);
    }
  }
  
  async getActiveChunks(): Promise<DocumentChunk[]> {
    return this.chunks.filter(chunk => this.activeChunks.has(chunk.id));
  }
}
```

---

## Usage Example

Here's how to use the complete solution:

```typescript
async function main() {
  const documentId = 'react-docs';
  const filePath = '/path/to/react-documentation.md';
  
  // Create a chunk store
  const chunkStore = new InMemoryChunkStore();
  
  // Initial processing
  console.log(`Processing document: ${filePath}`);
  const initialChunks = await processLargeDocument(filePath, documentId, '1.0');
  await chunkStore.storeChunks(initialChunks);
  console.log(`Created ${initialChunks.length} chunks for version 1.0`);
  
  // Later, when the document is updated
  const updatedContent = fs.readFileSync(filePath + '.updated', 'utf8');
  const updateResult = await updateDocument(
    documentId, 
    updatedContent, 
    '1.0', 
    chunkStore
  );
  
  console.log(`Updated to version ${updateResult.newVersion}`);
  console.log(`Created ${updateResult.chunkCount} new chunks`);
  
  // Retrieve the latest version chunks
  const latestChunks = await chunkStore.getChunksByDocumentId(documentId, updateResult.newVersion);
  console.log(`Latest version has ${latestChunks.length} chunks`);
}
```

---

## Key Design Decisions

1. **Line-by-Line Processing**
   - We never load the entire document into memory
   - Process by sections to keep memory usage low

2. **Structure Preservation**
   - We respect document headings and paragraphs
   - Each chunk includes its section title for context

3. **Simple Versioning**
   - Document versions are tracked in chunk metadata
   - Old versions are marked but not deleted

4. **Practical Update Strategy**
   - Create new chunks for updated documents
   - Keep track of version history
   - Simple but effective approach

---

## Performance Considerations

This solution is designed to handle large documents efficiently:

1. **Memory Usage**: Constant regardless of document size
2. **Processing Time**: Linear with document size
3. **Storage**: Keeps multiple versions for history

---

## Extensions and Improvements

For a more advanced solution, you could:

1. **Add diff detection** to only update changed sections
2. **Implement chunk relationships** to connect related content
3. **Add semantic analysis** to improve chunk boundaries
4. **Create a versioning system** with branching and merging

---

## Conclusion

This solution provides a practical approach to handling large documents in RAG systems. It addresses the key challenges of memory efficiency, semantic integrity, and basic update handling without unnecessary complexity.

The focus is on creating a system that works reliably while maintaining good retrieval quality - perfect for getting started with large document processing in RAG applications.