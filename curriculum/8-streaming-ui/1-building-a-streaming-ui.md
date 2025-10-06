# Building a Streaming UI with Next.js

After building our RAG backend system, we need a responsive frontend that provides a great user experience. In this section, we'll implement streaming responses using Next.js and the Vercel AI SDK.

## Why Streaming Responses Matter

RAG systems involve multiple steps (retrieval, context processing, generation) which can take several seconds. Streaming allows users to see partial responses as they're generated, providing:
- Immediate feedback that their request is being processed
- Incremental display of content as it's generated
- Better perceived performance and user engagement

## Implementing Streaming with Vercel AI SDK

The Vercel AI SDK makes it easy to implement streaming responses in Next.js applications. Here's a high-level overview of the implementation:

### Server-Side Implementation

On the server side, we need to create an API route that streams the response:

```typescript
// app/api/chat/route.ts
import { OpenAIStream, StreamingTextResponse } from 'ai';
import { OpenAI } from 'openai';
import { queryRAG } from '@/lib/rag-pipeline';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    // Get the user's message
    const { messages } = await req.json();
    const userMessage = messages[messages.length - 1].content;
    
    // Process with our RAG system to get context
    const { context, sources } = await queryRAG(userMessage);
    
    // Generate a streaming response
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      stream: true,
      messages: [
        { 
          role: 'system', 
          content: `You are a helpful assistant that answers questions based on the provided context.
          If the context doesn't contain relevant information, say "I don't have enough information to answer that."
          Always cite your sources when possible.`
        },
        ...messages.slice(0, -1), // Previous messages for conversation context
        { role: 'user', content: `Context:\n${context}\n\nQuestion: ${userMessage}` }
      ]
    });
    
    // Convert the response to a readable stream
    const stream = OpenAIStream(response, {
      onCompletion: async (completion) => {
        // Optional: Log or save the completion
        console.log('Stream completed:', completion);
      },
    });
    
    // Return a streaming response
    return new StreamingTextResponse(stream);
  } catch (error) {
    console.error('Error in chat API:', error);
    return new Response('An error occurred while processing your request', { status: 500 });
  }
}
```

### Client-Side Implementation

On the client side, we use the `useChat` hook to handle the streaming UI:

```typescript
// app/page.tsx
'use client';

import { useState } from 'react';
import { useChat } from 'ai/react';

export default function ChatUI() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat();
  
  return (
    <div className="flex flex-col h-screen max-w-3xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">RAG Chat Assistant</h1>
      
      <div className="flex-1 overflow-y-auto space-y-4 mb-4">
        {messages.map(message => (
          <div 
            key={message.id} 
            className={`p-3 rounded-lg ${
              message.role === 'user' 
                ? 'bg-blue-100 ml-auto max-w-md' 
                : 'bg-gray-100 mr-auto max-w-md'
            }`}
          >
            <div className="font-semibold mb-1">
              {message.role === 'user' ? 'You' : 'AI Assistant'}
            </div>
            <div className="whitespace-pre-wrap">{message.content}</div>
          </div>
        ))}
        
        {isLoading && (
          <div className="bg-gray-100 rounded-lg p-3 max-w-md animate-pulse">
            <div className="font-semibold mb-1">AI Assistant</div>
            <div>Thinking...</div>
          </div>
        )}
      </div>
      
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          className="flex-1 p-2 border border-gray-300 rounded"
          value={input}
          onChange={handleInputChange}
          placeholder="Ask a question..."
        />
        <button 
          type="submit" 
          className="bg-blue-500 text-white px-4 py-2 rounded"
          disabled={isLoading}
        >
          Send
        </button>
      </form>
    </div>
  );
}
```

## Setting Up the Vercel AI SDK

To get started with the Vercel AI SDK, you need to install it first:

```bash
npm install ai openai
```

Then, you can create a simple configuration file to set up your providers:

```typescript
// lib/ai-config.ts
import { OpenAI } from 'openai';

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
```

## Advanced UI Features

### 1. Loading States

Provide clear feedback during the streaming process:

```tsx
{isLoading && (
  <div className="loading-indicator">
    <div className="typing-dots">
      <span></span>
      <span></span>
      <span></span>
    </div>
  </div>
)}
```

### 2. Markdown Support

Use a library like `react-markdown` to render formatted content:

```tsx
import ReactMarkdown from 'react-markdown';

// In your component:
<ReactMarkdown>{message.content}</ReactMarkdown>
```

### 3. Source Citations

Display the sources used to generate the response:

```tsx
function SourceCitation({ sources }) {
  return (
    <div className="sources-container">
      <h3>Sources</h3>
      <ul>
        {sources.map((source, index) => (
          <li key={index}>
            <a href={source.url} target="_blank" rel="noopener noreferrer">
              {source.title}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

## Key Considerations for Streaming UIs

When implementing streaming responses, consider these best practices:

1. **Loading States**: Clearly indicate when the system is processing
2. **Error Handling**: Gracefully handle network or API errors
3. **Message History**: Maintain conversation context for follow-up questions
4. **Citation Display**: Show sources from your RAG system alongside responses
5. **Mobile Responsiveness**: Ensure the UI works well on all device sizes

## Exercise: Enhance the Streaming UI

Try implementing these enhancements to the basic streaming UI:

1. **Add syntax highlighting** for code blocks in responses
2. **Implement a typing effect** for a more natural feel
3. **Add a "Copy to clipboard" button** for responses
4. **Create a conversation history sidebar** to navigate between chats

## What's Next?

Now that you have a complete RAG system with a streaming UI, you're ready to deploy your application and start using it with real users! In the next section, we'll cover final project requirements and extensions to take your application even further.

<div style="position: relative; padding-bottom: 56.25%; height: 0;"><iframe src="https://www.loom.com/embed/placeholder-streaming-ui" frameborder="0" webkitallowfullscreen mozallowfullscreen allowfullscreen style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"></iframe></div> 