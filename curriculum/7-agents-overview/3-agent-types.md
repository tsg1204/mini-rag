# Agent Types and Specialist Agents

Now that we can get structured output from our agents, let's explore different types of specialist agents and how to build them. Each agent type excels at specific tasks.

Think of specialist agents like departments in a company - sales, support, engineering. Each has unique skills and handles specific types of work.

---

## The Multi-Agent Architecture

Here's how specialist agents work together:

```
User Query
    ↓
Router Agent (decides which specialist to use)
    ↓
┌───────────┬────────────┬──────────┬───────────┐
│  Search   │   Refine   │ Clarify  │  General  │
│   Agent   │   Agent    │  Agent   │   Agent   │
└───────────┴────────────┴──────────┴───────────┘
    ↓
Aggregator Agent (optional - combines/summarizes)
    ↓
Response to User
```

---

## 1. Router Agent

The router agent is the traffic controller - it analyzes requests and routes them to the right specialist.

### Implementation

```typescript
import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';
import OpenAI from 'openai';

const RouterDecisionSchema = z.object({
  action: z.enum([
    'search',
    'refine',
    'clarify',
    'general',
    'database',
    'launch',
    'campaignUpdate'
  ]),
  reasoning: z.string().describe('Why this action was chosen'),
  summary: z.string().describe('What will be done'),
  agentRequest: z.string().describe(
    'Formatted request for the specialist agent'
  ),
  useAggregator: z.boolean().optional().describe(
    'Whether to aggregate results after processing'
  ),
  acknowledgmentMessage: z.string(),
  progressSteps: z.array(z.string()).min(5).max(7)
});

const ROUTER_SYSTEM_PROMPT = `
You are a routing agent that analyzes user requests and determines the best action.

Available actions:
- search: Search vector database for relevant documents
- refine: Refine or filter existing results
- clarify: Ask user for more information
- general: Answer using general knowledge (no search needed)
- database: Direct database query (structured data)
- launch: Launch a new campaign
- campaignUpdate: Update existing campaign

Consider:
1. User's explicit request
2. Context from conversation history
3. Available data sources
4. Constraints (budget, time, resources)

Provide clear reasoning and helpful progress updates.
`;

export async function routeRequest(userQuery: string, context?: string) {
  const openai = new OpenAI();

  const userContent = context
    ? `Context: ${context}\n\nUser Query: ${userQuery}`
    : userQuery;

  const completion = await openai.beta.chat.completions.parse({
    model: 'gpt-4o-2024-08-06',
    messages: [
      { role: 'system', content: ROUTER_SYSTEM_PROMPT },
      { role: 'user', content: userContent }
    ],
    response_format: zodResponseFormat(RouterDecisionSchema, 'routerDecision')
  });

  return completion.choices[0].message.parsed;
}
```

### Example Usage

```typescript
const decision = await routeRequest(
  "Find me articles about AI from the last month and summarize the key trends"
);

console.log(decision);
// {
//   action: 'search',
//   reasoning: 'User wants recent articles and analysis - requires search + aggregation',
//   summary: 'Searching for recent AI articles and analyzing trends',
//   agentRequest: 'Search for articles about AI published in the last 30 days. Focus on trends, breakthroughs, and industry impact.',
//   useAggregator: true,
//   acknowledgmentMessage: 'I\'ll search for recent AI articles and analyze the key trends for you.',
//   progressSteps: [
//     'Analyzing your request',
//     'Searching recent articles',
//     'Filtering by relevance',
//     'Identifying key trends',
//     'Preparing summary'
//   ]
// }
```

---

## 2. Search Agent

Handles vector database searches and retrieval.

```typescript
const SearchAgentSchema = z.object({
  searchQuery: z.string().describe('Optimized search query for vector database'),
  filters: z.object({
    dateRange: z.object({
      start: z.string().optional(),
      end: z.string().optional()
    }).optional(),
    categories: z.array(z.string()).optional(),
    minRelevance: z.number().min(0).max(1).optional()
  }).optional(),
  limit: z.number().min(1).max(100).default(10),
  includeMetadata: z.boolean().default(true),
  reranking: z.object({
    enabled: z.boolean(),
    strategy: z.enum(['relevance', 'recency', 'popularity']).optional()
  }).optional()
});

const SEARCH_AGENT_PROMPT = `
You are a search specialist. Convert natural language queries into optimized
vector database searches.

Your job:
1. Extract the core search intent
2. Identify relevant filters (date, category, etc.)
3. Determine optimal result limit
4. Decide if reranking is needed

Make searches precise but not overly restrictive.
`;

export async function createSearchRequest(agentRequest: string) {
  const openai = new OpenAI();

  const completion = await openai.beta.chat.completions.parse({
    model: 'gpt-4o-2024-08-06',
    messages: [
      { role: 'system', content: SEARCH_AGENT_PROMPT },
      { role: 'user', content: agentRequest }
    ],
    response_format: zodResponseFormat(SearchAgentSchema, 'searchRequest')
  });

  return completion.choices[0].message.parsed;
}

// Usage
const searchRequest = await createSearchRequest(
  'Search for articles about AI published in the last 30 days. Focus on trends.'
);

console.log(searchRequest);
// {
//   searchQuery: 'artificial intelligence trends breakthroughs developments',
//   filters: {
//     dateRange: {
//       start: '2024-01-01',
//       end: '2024-02-01'
//     }
//   },
//   limit: 20,
//   includeMetadata: true,
//   reranking: {
//     enabled: true,
//     strategy: 'recency'
//   }
// }
```

---

## 3. Refine Agent

Filters, sorts, or refines existing results.

```typescript
const RefineAgentSchema = z.object({
  operation: z.enum([
    'filter',
    'sort',
    'deduplicate',
    'expand',
    'summarize'
  ]),
  criteria: z.object({
    filterBy: z.array(z.object({
      field: z.string(),
      condition: z.enum(['equals', 'contains', 'greater_than', 'less_than']),
      value: z.string()
    })).optional(),
    sortBy: z.object({
      field: z.string(),
      order: z.enum(['asc', 'desc'])
    }).optional(),
    limit: z.number().optional()
  }),
  reasoning: z.string()
});

const REFINE_AGENT_PROMPT = `
You are a results refinement specialist. Analyze user requests to refine,
filter, or reorganize existing results.

Operations:
- filter: Remove results that don't meet criteria
- sort: Reorder results by specific field
- deduplicate: Remove duplicate or similar results
- expand: Get more details about specific results
- summarize: Condense results into key points

Be precise about criteria and explain your reasoning.
`;

export async function createRefineRequest(agentRequest: string, currentResults: any[]) {
  const openai = new OpenAI();

  const completion = await openai.beta.chat.completions.parse({
    model: 'gpt-4o-2024-08-06',
    messages: [
      { role: 'system', content: REFINE_AGENT_PROMPT },
      {
        role: 'user',
        content: `Current results: ${JSON.stringify(currentResults, null, 2)}\n\nRequest: ${agentRequest}`
      }
    ],
    response_format: zodResponseFormat(RefineAgentSchema, 'refineRequest')
  });

  return completion.choices[0].message.parsed;
}
```

---

## 4. Clarify Agent

Asks users for more information when the request is ambiguous.

```typescript
const ClarifyAgentSchema = z.object({
  missingInformation: z.array(z.string()).describe(
    'List of missing pieces of information'
  ),
  questions: z.array(z.object({
    question: z.string(),
    suggestedAnswers: z.array(z.string()).optional(),
    required: z.boolean()
  })).min(1).max(3),
  reasoning: z.string(),
  canProceedWithDefaults: z.boolean().describe(
    'Whether we can proceed with reasonable defaults'
  ),
  defaults: z.record(z.string()).optional().describe(
    'Default values if user doesn\'t want to answer'
  )
});

const CLARIFY_AGENT_PROMPT = `
You are a clarification specialist. When requests are ambiguous or missing
critical information, ask clear, helpful questions.

Guidelines:
1. Ask 1-3 focused questions maximum
2. Provide suggested answers when helpful
3. Indicate which questions are required vs. optional
4. Offer sensible defaults when possible

Be helpful, not annoying. Only clarify what's truly needed.
`;

export async function createClarificationRequest(agentRequest: string) {
  const openai = new OpenAI();

  const completion = await openai.beta.chat.completions.parse({
    model: 'gpt-4o-2024-08-06',
    messages: [
      { role: 'system', content: CLARIFY_AGENT_PROMPT },
      { role: 'user', content: agentRequest }
    ],
    response_format: zodResponseFormat(ClarifyAgentSchema, 'clarifyRequest')
  });

  return completion.choices[0].message.parsed;
}

// Example
const clarification = await createClarificationRequest(
  "Find me articles about the policy changes"
);

console.log(clarification);
// {
//   missingInformation: ['Which policy', 'Time period', 'Region/country'],
//   questions: [
//     {
//       question: 'Which policy area are you interested in?',
//       suggestedAnswers: ['Trade policy', 'Climate policy', 'Healthcare policy'],
//       required: true
//     },
//     {
//       question: 'What time period?',
//       suggestedAnswers: ['Last week', 'Last month', 'Last year'],
//       required: false
//     }
//   ],
//   reasoning: 'Query is too broad - need to know specific policy area',
//   canProceedWithDefaults: false,
//   defaults: null
// }
```

---

## 5. General Agent

Handles queries that don't need specialized processing.

```typescript
const GeneralAgentSchema = z.object({
  response: z.string().describe('Direct response to user query'),
  confidence: z.number().min(0).max(1),
  sources: z.array(z.string()).optional().describe(
    'Knowledge sources used (if applicable)'
  ),
  suggestedFollowUps: z.array(z.string()).optional()
});

const GENERAL_AGENT_PROMPT = `
You are a general knowledge assistant. Answer questions directly using your
training data when specialized agents aren't needed.

Guidelines:
1. Be concise and accurate
2. Cite sources when making factual claims
3. Admit when you're uncertain
4. Suggest relevant follow-up questions

Don't search external databases - use your built-in knowledge.
`;
```

---

## 6. Aggregator Agent

Combines and synthesizes results from multiple sources or operations.

```typescript
const AggregatorSchema = z.object({
  summary: z.string().describe('High-level summary of all results'),
  keyInsights: z.array(z.string()).min(3).max(7).describe(
    'Main takeaways from the results'
  ),
  themes: z.array(z.object({
    theme: z.string(),
    frequency: z.number(),
    examples: z.array(z.string())
  })).optional(),
  confidence: z.number().min(0).max(1),
  recommendations: z.array(z.string()).optional()
});

const AGGREGATOR_AGENT_PROMPT = `
You are a synthesis specialist. Analyze multiple results and extract
key insights, patterns, and themes.

Your job:
1. Identify common themes across results
2. Extract the most important insights
3. Provide actionable recommendations
4. Present a coherent summary

Focus on signal, not noise. Highlight what matters most.
`;

export async function aggregateResults(results: any[], originalQuery: string) {
  const openai = new OpenAI();

  const completion = await openai.beta.chat.completions.parse({
    model: 'gpt-4o-2024-08-06',
    messages: [
      { role: 'system', content: AGGREGATOR_AGENT_PROMPT },
      {
        role: 'user',
        content: `Original query: ${originalQuery}\n\nResults to analyze:\n${JSON.stringify(results, null, 2)}`
      }
    ],
    response_format: zodResponseFormat(AggregatorSchema, 'aggregation')
  });

  return completion.choices[0].message.parsed;
}
```

---

## Orchestrating Multiple Agents

Here's how to coordinate agents in a complete workflow:

```typescript
export async function handleUserQuery(query: string, context?: string) {
  // Step 1: Route to appropriate agent
  const routing = await routeRequest(query, context);

  console.log(`🎯 Action: ${routing.action}`);
  console.log(`💭 Reasoning: ${routing.reasoning}`);
  console.log(`📋 Steps: ${routing.progressSteps.join(' → ')}`);

  let results;

  // Step 2: Execute specialist agent
  switch (routing.action) {
    case 'search':
      const searchParams = await createSearchRequest(routing.agentRequest);
      results = await executeVectorSearch(searchParams);
      break;

    case 'refine':
      const refineParams = await createRefineRequest(routing.agentRequest, context.previousResults);
      results = await refineResults(refineParams, context.previousResults);
      break;

    case 'clarify':
      const clarification = await createClarificationRequest(routing.agentRequest);
      return clarification; // Return early - need user input

    case 'general':
      const generalResponse = await handleGeneralQuery(routing.agentRequest);
      return generalResponse;

    default:
      throw new Error(`Unknown action: ${routing.action}`);
  }

  // Step 3: Optional aggregation
  if (routing.useAggregator) {
    const aggregated = await aggregateResults(results, query);
    return {
      ...aggregated,
      rawResults: results,
      routing
    };
  }

  return {
    results,
    routing
  };
}
```

---

## Testing Agent Coordination

```typescript
import { describe, it, expect } from 'vitest';

describe('Multi-Agent System', () => {
  it('routes search queries to search agent', async () => {
    const result = await handleUserQuery(
      'Find articles about climate change from 2024'
    );

    expect(result.routing.action).toBe('search');
    expect(result.results).toBeDefined();
  });

  it('uses aggregator for complex queries', async () => {
    const result = await handleUserQuery(
      'Find AI articles and summarize the key trends'
    );

    expect(result.routing.useAggregator).toBe(true);
    expect(result.summary).toBeDefined();
    expect(result.keyInsights.length).toBeGreaterThan(0);
  });

  it('requests clarification for ambiguous queries', async () => {
    const result = await handleUserQuery('Find articles about the new policy');

    expect(result.routing.action).toBe('clarify');
    expect(result.questions).toBeDefined();
    expect(result.questions.length).toBeGreaterThan(0);
  });
});
```

---

## Best Practices

### 1. Keep Agents Focused
Each agent should have a single, clear responsibility.

### 2. Use Clear System Prompts
Guide agents with detailed instructions about their role.

### 3. Validate Inputs and Outputs
Use Zod schemas to ensure data integrity.

### 4. Handle Edge Cases
Always have fallbacks for unexpected inputs.

### 5. Log Agent Decisions
Track which agents are used and why for debugging and optimization.

### 6. Monitor Performance
Measure response times and accuracy for each agent type.

---

## What's Next?

Now that you understand different agent types, let's learn how to thoroughly test your agent system to ensure reliability and accuracy!

---

<div style="position: relative; padding-bottom: 56.25%; height: 0;"><iframe src="https://www.loom.com/embed/placeholder-agent-types" frameborder="0" webkitallowfullscreen mozallowfullscreen allowfullscreen style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"></iframe></div>
