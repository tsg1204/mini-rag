# Structured Output with Zod

The biggest challenge with AI agents? Getting reliable, predictable responses you can actually use in your code. That's where structured output comes in.

Instead of parsing unpredictable text responses, we can tell the AI exactly what format we need using schemas. Think of it as TypeScript types for AI responses.

---

## The Problem with Text Responses

Traditional approach:

```typescript
// Ask AI to return JSON
const response = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: [
    {
      role: 'system',
      content: 'Return your response as JSON with fields: action, reasoning'
    },
    { role: 'user', content: 'Find articles about AI' }
  ]
});

// Hope it returns valid JSON
const text = response.choices[0].message.content;
const data = JSON.parse(text); // 🚨 Might fail!

console.log(data.action);   // 🤷 Might not exist
console.log(data.reasoning); // 🤷 Might be undefined
```

**Problems:**
- AI might return invalid JSON
- Fields might be missing or misspelled
- No type safety
- Fragile error-prone parsing

---

## Structured Output with Zod

Zod is a TypeScript schema validation library. When combined with OpenAI's structured output feature, it guarantees type-safe responses.

### Installation

```bash
yarn add zod zod-to-json-schema
```

---

## Basic Example

Let's start simple - getting the agent to classify a query:

```typescript
import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';
import OpenAI from 'openai';

// 1. Define your schema
const QueryClassification = z.object({
  category: z.enum(['search', 'general', 'creative']),
  confidence: z.number().min(0).max(1),
  reasoning: z.string()
});

// 2. Get structured response
const openai = new OpenAI();

const completion = await openai.beta.chat.completions.parse({
  model: 'gpt-4o-2024-08-06',
  messages: [
    { role: 'system', content: 'Classify the user query' },
    { role: 'user', content: 'Find me articles about climate change' }
  ],
  response_format: zodResponseFormat(QueryClassification, 'classification')
});

// 3. Get typed, guaranteed response
const result = completion.choices[0].message.parsed;

// ✅ TypeScript knows these fields exist!
console.log(result.category);   // 'search'
console.log(result.confidence); // 0.95
console.log(result.reasoning);  // 'User explicitly wants to find articles...'
```

**Why this is better:**
- ✅ Guaranteed valid data structure
- ✅ Full TypeScript autocomplete
- ✅ No manual parsing
- ✅ Built-in validation

---

## Real-World Agent Selector

Here's a production-ready agent selector using your example pattern:

```typescript
import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';

// Define all possible agent actions
const AgentDecisionSchema = z.object({
  action: z.enum([
    'search',      // Search vector database
    'refine',      // Refine existing results
    'clarify',     // Ask user for clarification
    'general',     // General knowledge query
    'database',    // Direct database query
    'launch',      // Launch a campaign
    'campaignUpdate' // Update campaign
  ]).describe('The type of action the agent should take'),

  reasoning: z.string().describe(
    'Clear explanation of why this action was chosen'
  ),

  summary: z.string().describe(
    'Brief summary of what will be done'
  ),

  agentRequest: z.string().describe(
    'The specific request to send to the specialist agent. ' +
    'Include all context, constraints, and requirements.'
  ),

  useAggregator: z.boolean().optional().describe(
    'Whether to run an aggregation step after the primary action'
  ),

  acknowledgmentMessage: z.string().describe(
    'Friendly message to show the user while processing'
  ),

  progressSteps: z.array(z.string()).min(5).max(7).describe(
    'Array of 5-7 steps describing the process'
  )
});

// Type inference - get TypeScript type from schema
type AgentDecision = z.infer<typeof AgentDecisionSchema>;

// Using it in your agent
async function selectAgent(
  userQuery: string,
  systemPrompt: string
): Promise<AgentDecision> {

  const openai = new OpenAI();

  const completion = await openai.beta.chat.completions.parse({
    model: 'gpt-4o-2024-08-06',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userQuery }
    ],
    response_format: zodResponseFormat(
      AgentDecisionSchema,
      'agentDecision'
    )
  });

  const decision = completion.choices[0].message.parsed;

  if (!decision) {
    throw new Error('Failed to get agent decision');
  }

  return decision;
}

// Example usage
const systemPrompt = `
You are a query routing agent. Analyze user requests and decide:
1. What action is needed
2. Whether additional processing is required
3. How to communicate progress to the user

Consider:
- Explicit user requests
- Implied needs
- Resource constraints
- Available tools
`;

const decision = await selectAgent(
  "Find me recent articles about AI and summarize the main points",
  systemPrompt
);

// ✅ Fully typed response
console.log(decision.action);                // 'search'
console.log(decision.reasoning);             // 'User wants search + summarization...'
console.log(decision.agentRequest);          // 'Search for AI articles from last 30 days...'
console.log(decision.useAggregator);         // true
console.log(decision.acknowledgmentMessage); // 'I'll search for AI articles and...'
console.log(decision.progressSteps);         // ['Searching database...', 'Filtering results...', ...]
```

---

## Schema Best Practices

### 1. Use Descriptions
Descriptions guide the AI on what to generate:

```typescript
const Schema = z.object({
  // ❌ Bad: No guidance
  action: z.string(),

  // ✅ Good: Clear description
  action: z.enum(['search', 'refine']).describe(
    'The type of action to take based on user intent'
  )
});
```

### 2. Constrain Values
Use Zod validators to ensure data quality:

```typescript
const Schema = z.object({
  confidence: z.number()
    .min(0)
    .max(1)
    .describe('Confidence score between 0 and 1'),

  summary: z.string()
    .min(10)
    .max(200)
    .describe('Brief summary, 10-200 characters'),

  tags: z.array(z.string())
    .min(1)
    .max(5)
    .describe('1-5 relevant tags')
});
```

### 3. Use Optional Fields Wisely
Make fields optional only when they truly might not apply:

```typescript
const Schema = z.object({
  action: z.enum(['search', 'clarify']),

  // Required: Always need reasoning
  reasoning: z.string(),

  // Optional: Only needed for search actions
  searchQuery: z.string().optional().describe(
    'Search query to use. Only required for search actions.'
  )
});
```

### 4. Nested Objects for Complex Data
Structure complex responses with nested schemas:

```typescript
const FilterSchema = z.object({
  field: z.string(),
  operator: z.enum(['equals', 'contains', 'greater_than']),
  value: z.string()
});

const SearchRequestSchema = z.object({
  query: z.string(),
  filters: z.array(FilterSchema).optional(),
  limit: z.number().min(1).max(100).default(10),
  sortBy: z.enum(['relevance', 'date', 'popularity']).optional()
});
```

---

## Handling Complex Agent Workflows

For multi-step agent workflows, you can chain structured outputs:

```typescript
// Step 1: Agent decides what to do
const decision = await openai.beta.chat.completions.parse({
  model: 'gpt-4o-2024-08-06',
  messages: [...],
  response_format: zodResponseFormat(AgentDecisionSchema, 'decision')
});

// Step 2: Based on decision, get specialist agent response
let result;

if (decision.parsed.action === 'search') {
  // Search agent with its own schema
  const SearchResultSchema = z.object({
    results: z.array(z.object({
      id: z.string(),
      title: z.string(),
      relevanceScore: z.number(),
      summary: z.string()
    })),
    totalFound: z.number(),
    searchQuery: z.string()
  });

  result = await openai.beta.chat.completions.parse({
    model: 'gpt-4o-2024-08-06',
    messages: [
      { role: 'system', content: 'You are a search specialist...' },
      { role: 'user', content: decision.parsed.agentRequest }
    ],
    response_format: zodResponseFormat(SearchResultSchema, 'searchResult')
  });
}

// Step 3: If aggregation needed, run aggregator
if (decision.parsed.useAggregator) {
  const AggregatorSchema = z.object({
    summary: z.string(),
    keyInsights: z.array(z.string()),
    confidence: z.number()
  });

  // Aggregate results...
}
```

---

## Error Handling

Always handle potential parsing failures:

```typescript
async function safeAgentCall(userQuery: string) {
  try {
    const completion = await openai.beta.chat.completions.parse({
      model: 'gpt-4o-2024-08-06',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userQuery }
      ],
      response_format: zodResponseFormat(AgentDecisionSchema, 'decision')
    });

    const decision = completion.choices[0].message.parsed;

    if (!decision) {
      console.error('No parsed response received');
      return { action: 'general' as const, error: 'Failed to parse response' };
    }

    return decision;

  } catch (error) {
    console.error('Agent call failed:', error);

    // Fallback to safe default
    return {
      action: 'general' as const,
      reasoning: 'Error occurred, defaulting to general response',
      summary: 'Processing your request...',
      agentRequest: userQuery,
      acknowledgmentMessage: 'Let me help you with that.',
      progressSteps: ['Processing request...']
    };
  }
}
```

---

## Testing Structured Output

You can validate your schemas without calling the API:

```typescript
import { describe, it, expect } from 'vitest';

describe('AgentDecisionSchema', () => {
  it('validates correct agent decisions', () => {
    const validDecision = {
      action: 'search',
      reasoning: 'User wants to find articles',
      summary: 'Searching for articles',
      agentRequest: 'Find articles about AI',
      acknowledgmentMessage: 'Searching...',
      progressSteps: [
        'Analyzing query',
        'Searching database',
        'Ranking results',
        'Filtering content',
        'Preparing response'
      ]
    };

    const result = AgentDecisionSchema.safeParse(validDecision);
    expect(result.success).toBe(true);
  });

  it('rejects invalid action types', () => {
    const invalid = {
      action: 'invalid_action',
      reasoning: 'Test',
      summary: 'Test',
      agentRequest: 'Test',
      acknowledgmentMessage: 'Test',
      progressSteps: ['Step 1', 'Step 2', 'Step 3', 'Step 4', 'Step 5']
    };

    const result = AgentDecisionSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('requires minimum number of progress steps', () => {
    const tooFewSteps = {
      action: 'search',
      reasoning: 'Test',
      summary: 'Test',
      agentRequest: 'Test',
      acknowledgmentMessage: 'Test',
      progressSteps: ['Step 1', 'Step 2'] // Only 2, need 5-7
    };

    const result = AgentDecisionSchema.safeParse(tooFewSteps);
    expect(result.success).toBe(false);
  });
});
```

---

## What's Next?

Now that you can get reliable structured output from your agents, let's explore different types of specialist agents and how to coordinate them effectively!

---

<div style="position: relative; padding-bottom: 56.25%; height: 0;"><iframe src="https://www.loom.com/embed/placeholder-structured-output" frameborder="0" webkitallowfullscreen mozallowfullscreen allowfullscreen style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"></iframe></div>
