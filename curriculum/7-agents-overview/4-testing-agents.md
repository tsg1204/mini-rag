# Testing AI Agents

Testing AI agents is different from testing traditional code. You're not just checking if functions return the right values - you're validating that an AI makes smart decisions consistently.

Let's explore practical strategies for testing agent systems.

---

## Why Testing Agents is Challenging

Traditional testing:
```typescript
// Deterministic - always same output
expect(add(2, 3)).toBe(5); ✅
```

AI agent testing:
```typescript
// Non-deterministic - varies slightly each time
const decision = await agent.decide("Find AI articles");
expect(decision.action).toBe('search'); // ✅ Usually...
expect(decision.reasoning).toBe('...'); // ❌ Different each time
```

**Challenges:**
- Non-deterministic outputs
- Natural language variation
- Context-dependent behavior
- Harder to define "correct" answers

---

## Types of Agent Tests

### 1. Schema Validation Tests
Ensure structured output matches expected format.

```typescript
import { describe, it, expect } from 'vitest';
import { z } from 'zod';

const AgentDecisionSchema = z.object({
  action: z.enum(['search', 'refine', 'clarify', 'general']),
  reasoning: z.string(),
  summary: z.string(),
  agentRequest: z.string(),
  acknowledgmentMessage: z.string(),
  progressSteps: z.array(z.string()).min(5).max(7)
});

describe('Schema Validation', () => {
  it('validates correct agent decisions', () => {
    const validDecision = {
      action: 'search',
      reasoning: 'User wants to find articles',
      summary: 'Searching for AI articles',
      agentRequest: 'Find articles about AI',
      acknowledgmentMessage: 'Searching for you...',
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
    if (result.success) {
      expect(result.data.action).toBe('search');
    }
  });

  it('rejects invalid action types', () => {
    const invalid = {
      action: 'invalid_action',
      reasoning: 'Test',
      summary: 'Test',
      agentRequest: 'Test',
      acknowledgmentMessage: 'Test',
      progressSteps: ['1', '2', '3', '4', '5']
    };

    const result = AgentDecisionSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('requires minimum progress steps', () => {
    const tooFewSteps = {
      action: 'search',
      reasoning: 'Test',
      summary: 'Test',
      agentRequest: 'Test',
      acknowledgmentMessage: 'Test',
      progressSteps: ['1', '2'] // Only 2, need 5-7
    };

    const result = AgentDecisionSchema.safeParse(tooFewSteps);
    expect(result.success).toBe(false);
  });
});
```

---

### 2. Action Selection Tests
Verify agents choose the right action for different query types.

```typescript
import { routeRequest } from './router-agent';

describe('Router Agent - Action Selection', () => {
  it('selects search for article queries', async () => {
    const decision = await routeRequest(
      'Find articles about climate change'
    );

    expect(decision).toBeDefined();
    expect(decision.action).toBe('search');
  });

  it('selects clarify for ambiguous queries', async () => {
    const decision = await routeRequest(
      'Tell me about the policy'
    );

    // Ambiguous - which policy? what aspect?
    expect(decision.action).toBe('clarify');
  });

  it('selects general for knowledge questions', async () => {
    const decision = await routeRequest(
      'What is the capital of France?'
    );

    expect(decision.action).toBe('general');
  });

  it('selects refine when narrowing results', async () => {
    const decision = await routeRequest(
      'Show me only the most recent ones',
      'Previous search returned 50 articles'
    );

    expect(decision.action).toBe('refine');
  });
});
```

---

### 3. Output Quality Tests
Validate that responses meet quality standards.

```typescript
describe('Router Agent - Output Quality', () => {
  it('provides meaningful reasoning', async () => {
    const decision = await routeRequest(
      'Find AI articles and summarize trends'
    );

    expect(decision.reasoning).toBeDefined();
    expect(decision.reasoning.length).toBeGreaterThan(20);
    expect(decision.reasoning.toLowerCase()).toContain('search');
  });

  it('creates appropriate progress steps', async () => {
    const decision = await routeRequest(
      'Find climate change articles'
    );

    expect(decision.progressSteps).toBeDefined();
    expect(decision.progressSteps.length).toBeGreaterThanOrEqual(5);
    expect(decision.progressSteps.length).toBeLessThanOrEqual(7);

    // First step should be about analyzing/processing
    expect(
      decision.progressSteps[0].toLowerCase()
    ).toMatch(/analyz|process|review/);
  });

  it('provides friendly acknowledgment', async () => {
    const decision = await routeRequest(
      'Search for articles'
    );

    expect(decision.acknowledgmentMessage).toBeDefined();
    expect(decision.acknowledgmentMessage.length).toBeGreaterThan(10);
    // Should be friendly, not robotic
    expect(decision.acknowledgmentMessage).not.toMatch(/^Executing|^Processing/);
  });
});
```

---

### 4. Edge Case Tests
Handle unusual or problematic inputs.

```typescript
describe('Router Agent - Edge Cases', () => {
  it('handles empty queries gracefully', async () => {
    const decision = await routeRequest('');

    expect(decision).toBeDefined();
    expect(decision.action).toBe('clarify');
  });

  it('handles very long queries', async () => {
    const longQuery = 'Find articles about '.repeat(100) + 'AI';

    const decision = await routeRequest(longQuery);

    expect(decision).toBeDefined();
    expect(decision.action).toBeDefined();
  });

  it('handles queries with special characters', async () => {
    const decision = await routeRequest(
      'Find articles about AI & ML (2024) @latest #trends'
    );

    expect(decision).toBeDefined();
    expect(decision.action).toBe('search');
  });

  it('handles multilingual queries', async () => {
    const decision = await routeRequest(
      'Encuentra artículos sobre inteligencia artificial'
    );

    expect(decision).toBeDefined();
    expect(decision.action).toBeDefined();
  });
});
```

---

### 5. Integration Tests
Test multiple agents working together.

```typescript
import { handleUserQuery } from './agent-orchestrator';

describe('Multi-Agent Integration', () => {
  it('completes full search workflow', async () => {
    const result = await handleUserQuery(
      'Find recent AI articles and summarize key points'
    );

    // Should route to search
    expect(result.routing.action).toBe('search');

    // Should use aggregator
    expect(result.routing.useAggregator).toBe(true);

    // Should have summary
    expect(result.summary).toBeDefined();
    expect(result.keyInsights).toBeDefined();
    expect(result.keyInsights.length).toBeGreaterThan(0);
  });

  it('handles clarification flow', async () => {
    const result = await handleUserQuery(
      'Find articles about the policy changes'
    );

    expect(result.routing.action).toBe('clarify');
    expect(result.questions).toBeDefined();
    expect(result.questions.length).toBeGreaterThan(0);
  });

  it('uses general agent for simple questions', async () => {
    const result = await handleUserQuery(
      'What is machine learning?'
    );

    expect(result.routing.action).toBe('general');
    expect(result.response).toBeDefined();
  });
});
```

---

## Testing Strategies

### 1. Use Low Temperature for Consistency
Make tests more predictable:

```typescript
const completion = await openai.beta.chat.completions.parse({
  model: 'gpt-4o-2024-08-06',
  temperature: 0, // Most deterministic
  messages: [...],
  response_format: zodResponseFormat(schema, 'decision')
});
```

### 2. Test Categories, Not Exact Matches
```typescript
// ❌ Too brittle - exact match
expect(decision.reasoning).toBe(
  'User wants to find articles about AI from recent publications'
);

// ✅ Better - test category/intent
expect(decision.reasoning).toContain('search');
expect(decision.reasoning.length).toBeGreaterThan(20);

// ✅ Even better - test structure
expect(decision).toMatchObject({
  action: 'search',
  reasoning: expect.any(String)
});
```

### 3. Create Golden Test Cases
Build a suite of well-defined examples:

```typescript
const GOLDEN_TEST_CASES = [
  {
    name: 'Explicit search query',
    input: 'Find articles about climate change from 2024',
    expectedAction: 'search',
    expectedFilters: { dateRange: true }
  },
  {
    name: 'Ambiguous reference',
    input: 'Find articles about the policy',
    expectedAction: 'clarify',
    expectedQuestions: ['Which policy', 'Time period']
  },
  {
    name: 'General knowledge',
    input: 'What is the capital of France?',
    expectedAction: 'general',
    shouldNotSearch: true
  },
  {
    name: 'Refinement request',
    input: 'Show me only the most recent ones',
    expectedAction: 'refine',
    requiresContext: true
  }
];

describe('Golden Test Cases', () => {
  GOLDEN_TEST_CASES.forEach(testCase => {
    it(testCase.name, async () => {
      const decision = await routeRequest(testCase.input);

      expect(decision.action).toBe(testCase.expectedAction);

      if (testCase.expectedFilters) {
        // Verify filters are present
      }

      if (testCase.expectedQuestions) {
        // Verify questions match expected topics
      }
    });
  });
});
```

### 4. Snapshot Testing for Prompts
Track when system prompts change:

```typescript
import { describe, it, expect } from 'vitest';
import { ROUTER_SYSTEM_PROMPT } from './router-agent';

describe('System Prompts', () => {
  it('matches snapshot', () => {
    expect(ROUTER_SYSTEM_PROMPT).toMatchSnapshot();
  });
});
```

This creates a snapshot file. If prompt changes, test fails until you approve the new version.

---

## Mocking for Faster Tests

Mock OpenAI calls for unit tests:

```typescript
import { vi, describe, it, expect } from 'vitest';
import OpenAI from 'openai';

// Mock OpenAI
vi.mock('openai');

describe('Router Agent (Mocked)', () => {
  it('parses response correctly', async () => {
    const mockParse = vi.fn().mockResolvedValue({
      choices: [{
        message: {
          parsed: {
            action: 'search',
            reasoning: 'Test reasoning',
            summary: 'Test summary',
            agentRequest: 'Test request',
            acknowledgmentMessage: 'Test message',
            progressSteps: ['1', '2', '3', '4', '5']
          }
        }
      }]
    });

    const mockOpenAI = {
      beta: {
        chat: {
          completions: {
            parse: mockParse
          }
        }
      }
    };

    (OpenAI as any).mockImplementation(() => mockOpenAI);

    const decision = await routeRequest('Test query');

    expect(mockParse).toHaveBeenCalled();
    expect(decision.action).toBe('search');
  });
});
```

---

## Manual Testing with Scripts

Create test scripts for interactive testing:

```typescript
// scripts/test-agent.ts
import { routeRequest } from './router-agent';

async function testAgent() {
  const queries = [
    'Find articles about AI from 2024',
    'Tell me about the policy',
    'What is machine learning?',
    'Show me the most recent results'
  ];

  for (const query of queries) {
    console.log('\n' + '='.repeat(50));
    console.log(`Query: ${query}`);
    console.log('='.repeat(50));

    const decision = await routeRequest(query);

    console.log(`Action: ${decision.action}`);
    console.log(`Reasoning: ${decision.reasoning}`);
    console.log(`Summary: ${decision.summary}`);
    console.log(`Steps: ${decision.progressSteps.join(' → ')}`);
  }
}

testAgent();
```

Run it:
```bash
npx tsx scripts/test-agent.ts
```

---

## Monitoring in Production

Track agent performance in production:

```typescript
interface AgentMetrics {
  timestamp: Date;
  query: string;
  action: string;
  responseTime: number;
  success: boolean;
  error?: string;
}

async function monitoredRouteRequest(query: string) {
  const startTime = Date.now();
  const metrics: AgentMetrics = {
    timestamp: new Date(),
    query,
    action: '',
    responseTime: 0,
    success: false
  };

  try {
    const decision = await routeRequest(query);
    metrics.action = decision.action;
    metrics.success = true;
    metrics.responseTime = Date.now() - startTime;

    // Log to monitoring service
    await logMetrics(metrics);

    return decision;
  } catch (error) {
    metrics.error = error.message;
    metrics.responseTime = Date.now() - startTime;

    // Log error
    await logMetrics(metrics);

    throw error;
  }
}
```

---

## Testing Checklist

✅ **Schema Validation**
- All required fields present
- Correct data types
- Enum values valid

✅ **Action Selection**
- Correct actions for query types
- Context considered appropriately
- Edge cases handled

✅ **Output Quality**
- Reasoning is meaningful
- Progress steps are logical
- Messages are user-friendly

✅ **Integration**
- Agents work together correctly
- Data flows between agents
- Aggregation works as expected

✅ **Performance**
- Response times acceptable
- No unnecessary API calls
- Efficient token usage

---

## Best Practices

### 1. Test Behavior, Not Implementation
Focus on what agents do, not how they do it.

### 2. Use Real API Calls Sparingly
Mock for unit tests, use real API for integration tests.

### 3. Create Representative Test Data
Use realistic queries that match production usage.

### 4. Monitor and Update Tests
As your agent improves, update tests to match new capabilities.

### 5. Test Edge Cases
Empty inputs, very long inputs, special characters, etc.

### 6. Validate Error Handling
Ensure agents fail gracefully and provide helpful messages.

---

## What's Next?

You now have a solid foundation in AI agents! In the next section, we'll tackle a real-world challenge: migrating a fine-tuning solution to a RAG-based approach, combining everything you've learned.

---

<div style="position: relative; padding-bottom: 56.25%; height: 0;"><iframe src="https://www.loom.com/embed/placeholder-testing-agents" frameborder="0" webkitallowfullscreen mozallowfullscreen allowfullscreen style="position: absolute; top: 0; left: 0; width: 100%; height: 100%;"></iframe></div>
