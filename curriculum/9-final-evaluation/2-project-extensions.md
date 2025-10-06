# RAG Applications: Extensions and Customizations

Now that you've built a basic RAG application, you can take it to the next level by customizing it to your specific needs. This guide covers various ways to extend your application.

## Domain-Specific Knowledge

One of the most powerful ways to customize your RAG application is to make it domain-specific:

### 1. Specialized Knowledge Bases

Choose a domain that interests you or is relevant to your work:

- **Technical Documentation**: Framework docs, API references, tutorials
- **Academic Research**: Research papers, academic articles, course materials
- **Company Knowledge**: Internal docs, policies, procedures, FAQs
- **Product Documentation**: User manuals, troubleshooting guides, feature descriptions
- **Legal/Compliance**: Legal documents, regulations, compliance guides
- **Educational Content**: Course materials, textbooks, lecture notes

### 2. Custom Agents

You can customize your RAG system by adding or removing agents based on your needs:

- **Add specialized agents** for domain-specific tasks (e.g., code analysis, data visualization)
- **Remove agents** that aren't relevant to your use case
- **Chain agents together** for more complex workflows

### 3. Fine-Tuning Models

If you have domain-specific data, consider fine-tuning your own model:

- Use [OpenAI's fine-tuning API](https://platform.openai.com/docs/guides/fine-tuning) for customizing models
- Create a dataset of domain-specific Q&A pairs
- Fine-tune for better domain-specific responses and reduced hallucinations

## UI Enhancements

For more advanced UI features beyond the streaming implementation covered in Section 8, consider:

- **Source Attribution UI**: Visually link generated content to source documents
- **Interactive Citations**: Allow users to expand/collapse source material
- **Feedback Mechanisms**: Add thumbs up/down buttons to track response quality
- **Multi-modal Inputs**: Support image uploads alongside text queries
- **Theme Customization**: Add light/dark mode and branding options

## Advanced UI Features

Building on the streaming UI implementation from Section 8, you can add these advanced features:

### 1. Citation Highlighting

```typescript
// components/SourceHighlighter.tsx
import React from 'react';

interface Source {
  title: string;
  content: string;
  url?: string;
  score: number;
}

interface SourceHighlighterProps {
  answer: string;
  sources: Source[];
}

export default function SourceHighlighter({ answer, sources }: SourceHighlighterProps) {
  const [activeSource, setActiveSource] = React.useState<Source | null>(null);
  
  // Find citations in the format [1], [2], etc.
  const answerWithHighlights = answer.replace(
    /\[(\d+)\]/g,
    (match, sourceIndex) => {
      const index = parseInt(sourceIndex, 10) - 1;
      if (index >= 0 && index < sources.length) {
        return `<span class="citation" data-source-index="${index}">${match}</span>`;
      }
      return match;
    }
  );
  
  return (
    <div className="answer-container">
      <div 
        className="answer"
        dangerouslySetInnerHTML={{ __html: answerWithHighlights }}
        onClick={(e) => {
          const target = e.target as HTMLElement;
          if (target.classList.contains('citation')) {
            const sourceIndex = parseInt(target.getAttribute('data-source-index') || '0', 10);
            setActiveSource(sources[sourceIndex]);
          }
        }}
      />
      
      {activeSource && (
        <div className="source-popup">
          <h3>{activeSource.title}</h3>
          <p>{activeSource.content}</p>
          {activeSource.url && (
            <a href={activeSource.url} target="_blank" rel="noopener noreferrer">
              View Source
            </a>
          )}
          <button onClick={() => setActiveSource(null)}>Close</button>
        </div>
      )}
    </div>
  );
}
```

### 2. Streaming Markdown Support

```typescript
// components/MarkdownStream.tsx
import React from 'react';
import ReactMarkdown from 'react-markdown';
import { useChat } from 'ai/react';

export default function MarkdownStream() {
  const { messages, input, handleInputChange, handleSubmit } = useChat();
  
  return (
    <div className="chat-container">
      <div className="messages">
        {messages.map(message => (
          <div key={message.id} className={`message ${message.role}`}>
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        ))}
      </div>
      
      <form onSubmit={handleSubmit} className="input-form">
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="Ask a question..."
          className="message-input"
        />
        <button type="submit" className="send-button">
          Send
        </button>
      </form>
    </div>
  );
}
```

For more advanced UI implementations, refer to Section 8: Building a Streaming UI with Next.js.

## Observability with Helicone

Observability is crucial for monitoring and improving your RAG application. [Helicone](https://www.helicone.ai/) provides powerful tools for tracking LLM usage and performance.

### 1. Setting Up Helicone

```typescript
// src/lib/openai.ts
import OpenAI from 'openai';

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: 'https://oai.hconeai.com/v1',
  defaultHeaders: {
    'Helicone-Auth': `Bearer ${process.env.HELICONE_API_KEY}`
  }
});
```

Add to your `.env.local` file:

```
HELICONE_API_KEY=your_helicone_api_key_here
```

### 2. Tracking Custom Properties

```typescript
// Add custom properties to track specific metrics
openai.chat.completions.create({
  model: 'gpt-3.5-turbo',
  messages: [{ role: 'user', content: 'Hello!' }],
  headers: {
    'Helicone-Property-Session-Id': sessionId,
    'Helicone-Property-User-Id': userId,
    'Helicone-Property-Query-Type': 'product-search'
  }
});
```

### 3. Monitoring RAG Effectiveness

With Helicone, you can:

- Track retrieval quality by monitoring response relevance
- Identify when your system is degrading in performance
- Analyze which types of queries perform well or poorly
- Optimize your system based on real usage patterns

### 4. Cost Management

Helicone helps you:

- Track token usage and associated costs
- Identify expensive or inefficient queries
- Set up alerts for unusual usage patterns
- Optimize prompts for better cost efficiency

## Saving Chat History with Prisma

Adding persistent chat history improves user experience and enables better context management.

### 1. Setting Up Prisma

First, install Prisma:

```bash
npm install prisma @prisma/client
npx prisma init
```

### 2. Define Your Schema

Create a schema for conversations and messages:

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql" // or "mysql", "sqlite", etc.
  url      = env("DATABASE_URL")
}

model User {
  id            String         @id @default(cuid())
  email         String         @unique
  name          String?
  conversations Conversation[]
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
}

model Conversation {
  id        String    @id @default(cuid())
  title     String
  userId    String
  user      User      @relation(fields: [userId], references: [id])
  messages  Message[]
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
}

model Message {
  id             String       @id @default(cuid())
  content        String
  role           String       // "user" or "assistant"
  conversationId String
  conversation   Conversation @relation(fields: [conversationId], references: [id])
  sources        Source[]
  createdAt      DateTime     @default(now())
}

model Source {
  id        String   @id @default(cuid())
  title     String
  content   String
  url       String?
  score     Float
  messageId String
  message   Message  @relation(fields: [messageId], references: [id])
  createdAt DateTime @default(now())
}
```

### 3. Generate Prisma Client

```bash
npx prisma generate
npx prisma db push
```

### 4. Create Database Service

```typescript
// src/lib/db/conversation-service.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function createConversation(userId: string, title: string) {
  return prisma.conversation.create({
    data: {
      title,
      userId
    }
  });
}

export async function getConversations(userId: string) {
  return prisma.conversation.findMany({
    where: {
      userId
    },
    orderBy: {
      updatedAt: 'desc'
    },
    include: {
      messages: {
        orderBy: {
          createdAt: 'asc'
        },
        include: {
          sources: true
        }
      }
    }
  });
}

export async function addMessage(
  conversationId: string,
  content: string,
  role: 'user' | 'assistant',
  sources: Array<{ title: string; content: string; url?: string; score: number }> = []
) {
  return prisma.message.create({
    data: {
      content,
      role,
      conversationId,
      sources: {
        create: sources
      }
    },
    include: {
      sources: true
    }
  });
}
```

### 5. Integrate with Your API Routes

```typescript
// src/app/api/chat/route.ts
import { getServerSession } from 'next-auth';
import { createConversation, addMessage } from '@/lib/db/conversation-service';

export async function POST(req: Request) {
  const { messages, conversationId } = await req.json();
  const session = await getServerSession();
  
  // Ensure user is authenticated
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  // Get or create conversation
  let currentConversationId = conversationId;
  if (!currentConversationId) {
    const newConversation = await createConversation(
      session.user.id,
      messages[0]?.content.slice(0, 100) || 'New conversation'
    );
    currentConversationId = newConversation.id;
  }
  
  // Add user message to database
  const userMessage = messages[messages.length - 1];
  await addMessage(currentConversationId, userMessage.content, 'user');
  
  // Process with RAG system and get response
  const ragSystem = new RAGSystem();
  const context = await ragSystem.retrieveContext(userMessage.content);
  const response = await ragSystem.generateResponse(userMessage.content, context, messages);
  
  // Add assistant response to database with sources
  await addMessage(
    currentConversationId,
    response.content,
    'assistant',
    response.sources.map(s => ({
      title: s.title,
      content: s.snippet,
      url: s.url,
      score: s.score
    }))
  );
  
  return Response.json({
    content: response.content,
    sources: response.sources,
    conversationId: currentConversationId
  });
}
```

## Advanced RAG Techniques

Consider implementing these advanced techniques to improve your RAG system:

### 1. Multi-query Retrieval

Generate multiple variations of the user's query to improve retrieval:

```typescript
async function generateQueryVariations(query: string): Promise<string[]> {
  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [
      {
        role: 'system',
        content: 'Generate 3 different versions of this search query, focusing on different aspects.'
      },
      { role: 'user', content: query }
    ]
  });
  
  const content = response.choices[0].message.content || '';
  const variations = content.split('\n').filter(Boolean);
  
  return [query, ...variations];
}
```

### 2. Hybrid Search

Combine vector search with keyword search for better results:

```typescript
async function hybridSearch(query: string, topK = 5) {
  // Vector search
  const vectorResults = await vectorStore.similaritySearch(query, topK);
  
  // Keyword search (using a library like FlexSearch)
  const keywordResults = await keywordIndex.search(query, { limit: topK });
  
  // Combine and rank results
  const combinedResults = [...vectorResults, ...keywordResults];
  return rankResults(combinedResults, query).slice(0, topK);
}
```

### 3. Re-ranking

Improve relevance by re-ranking retrieved documents:

```typescript
async function rerank(query: string, documents: Document[], topK = 5) {
  const pairs = documents.map(doc => ({
    text: doc.text,
    id: doc.id
  }));
  
  const response = await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input: [query, ...pairs.map(p => p.text)]
  });
  
  const queryEmbedding = response.data[0].embedding;
  const docEmbeddings = response.data.slice(1).map(d => d.embedding);
  
  // Calculate cosine similarity
  const similarities = docEmbeddings.map((emb, i) => ({
    document: documents[i],
    score: cosineSimilarity(queryEmbedding, emb)
  }));
  
  return similarities.sort((a, b) => b.score - a.score).slice(0, topK);
}
```

## Conclusion

By implementing these extensions, you can transform your basic RAG application into a powerful, domain-specific tool with robust observability and persistent conversation history. The possibilities for customization are endless - you now have the knowledge to build RAG applications tailored to your specific needs.

## Example Project Ideas

Here are some example project ideas to inspire your capstone project:

### 1. **React Developer Assistant**
- **Sources**: React docs, common patterns, best practices
- **Special Features**: Code snippet highlighting, live examples
- **Sample Questions**: "How do I optimize React performance?", "When should I use useCallback?"

### 2. **Startup Legal Helper**
- **Sources**: Legal templates, startup guides, compliance docs
- **Special Features**: Document templates, checklist generation
- **Sample Questions**: "What do I need for a Series A?", "How do I handle equity splits?"

### 3. **Course Companion Bot**
- **Sources**: Course materials, lecture transcripts, readings
- **Special Features**: Quiz generation, concept explanations
- **Sample Questions**: "Explain binary search trees", "What's the difference between HTTP and HTTPS?"

## Getting Help

If you get stuck:

1. **Review the curriculum**: Go back to specific sections for reference
2. **Check the examples**: Use the code examples as templates
3. **Debug systematically**: 
   - Test each component separately
   - Check API responses
   - Verify environment variables
   - Look at browser console/network tabs

## Next Steps

**After submission**:
- You'll receive detailed feedback
- Consider continuing to improve your project
- Think about real-world deployment
- Explore more advanced RAG techniques

## Testing & Documentation (30 minutes)

### Comprehensive Testing

Before finalizing your project:

1. **Test with various question types**
   - Simple factual questions
   - Complex multi-part questions
   - Questions requiring synthesis of multiple sources
   - Edge cases and out-of-domain questions

2. **Verify edge cases**
   - Empty queries
   - Very long queries
   - Queries with special characters
   - Queries in different languages

3. **Check mobile responsiveness**
   - Test on different screen sizes
   - Ensure touch interactions work properly
   - Verify that the UI adapts correctly

### Write Documentation

Create comprehensive documentation for your project:

1. **README.md with:**
   - Project description and domain choice
   - Setup and installation instructions
   - 5-10 sample questions to test
   - Architecture overview
   - Challenges faced and solutions

2. **Code documentation:**
   - Add comments to complex functions
   - Document key classes and interfaces
   - Explain architectural decisions

3. **User guide:**
   - How to use the application
   - Features and limitations
   - Troubleshooting tips 