# Integrating Helicone for AI Observability

Production AI applications need visibility into API calls, costs, latency, and errors. This is where **Helicone** comes in - an observability platform specifically built for LLM applications.

---

## What You'll Learn

-   Why observability matters for AI applications
-   How Helicone tracks OpenAI API usage
-   Setting up Helicone with minimal code changes
-   Monitoring costs, performance, and usage patterns

---

## Why Observability Matters

### The Problem with "Black Box" AI

Without observability, you're flying blind:

❌ **Cost surprises**: Suddenly $500 bill, no idea why
❌ **Performance issues**: Slow responses, can't debug
❌ **Quality problems**: Bad outputs, no data to improve
❌ **Usage patterns**: Don't know what users are asking

### What Good Observability Provides

✅ **Cost tracking**: Per-user, per-agent, per-request costs
✅ **Performance monitoring**: Latency, throughput, errors
✅ **Quality metrics**: Token usage, model performance
✅ **Usage insights**: Popular queries, failure patterns
✅ **Debugging**: Full request/response logs

---

## Introducing Helicone

**Helicone** is an open-source observability platform for LLM applications.

**Key Features:**

-   🔍 Request/response logging
-   💰 Cost tracking per request
-   ⚡ Latency monitoring
-   🎯 Custom properties for filtering
-   📊 Usage analytics and dashboards
-   🔐 User tracking and rate limiting
-   🪝 Webhook integrations

**Why Helicone?**

-   Simple integration (literally 2 lines of code)
-   Open source (self-host option)
-   Free tier (generous limits)
-   OpenAI-specific optimizations

**Learn more:**

-   [Helicone Documentation](https://docs.helicone.ai/)
-   [Helicone GitHub](https://github.com/Helicone/helicone)

---

## Setting Up Helicone

### Step 1: Create Helicone Account

1. Go to [helicone.ai](https://www.helicone.ai/)
2. Sign up for free account
3. Navigate to API Keys section
4. Copy your Helicone API key

### Step 2: Add to Environment Variables

Add to your `.env` or `.env.local`:

```bash
HELICONE_API_KEY=sk-helicone-xxxxxxxxxxxxxxxxxxxxxxxx
```

### Step 3: Update OpenAI Client

The integration is incredibly simple. Update `app/libs/openai/openai.ts`:

**Before:**

```typescript
import OpenAI from 'openai';

export const openaiClient = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY as string,
});
```

**After:**

```typescript
import OpenAI from 'openai';

export const openaiClient = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY as string,
	baseURL: `https://oai.helicone.ai/v1/${process.env.HELICONE_API_KEY}`,
});
```

**That's it!** All OpenAI API calls now flow through Helicone's proxy and get logged.

---

## How It Works

### The Proxy Pattern

```
Your App → Helicone Proxy → OpenAI API
            ↓
         Logs data
            ↓
      Helicone Dashboard
```

Helicone sits between your app and OpenAI:

1. Receives your API requests
2. Logs metadata (timestamp, tokens, cost)
3. Forwards request to OpenAI
4. Returns OpenAI's response
5. Logs response metadata

**Performance impact:** ~10-20ms additional latency (negligible)

---

## Viewing Your Data

### Helicone Dashboard

Once integrated, visit your Helicone dashboard to see:

**1. Request Log**

-   Every API call with full request/response
-   Timestamps, latency, tokens used
-   Model, user, and custom properties

**2. Cost Analytics**

-   Total spend over time
-   Cost per model/agent/user
-   Token usage trends

**3. Performance Metrics**

-   Average latency per endpoint
-   Error rates
-   Request volume

**4. User Analytics**

-   Top users by request count
-   Cost per user
-   User behavior patterns

---

## Advanced: Custom Properties

Add metadata to track specific information:

```typescript
import OpenAI from 'openai';

export const openaiClient = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY as string,
	baseURL: `https://oai.helicone.ai/v1/${process.env.HELICONE_API_KEY}`,
});

// When making requests, add custom properties:
const response = await openaiClient.chat.completions.create(
	{
		model: 'gpt-4o-mini',
		messages: [{ role: 'user', content: query }],
	},
	{
		headers: {
			'Helicone-Property-Agent': 'linkedin', // Track which agent
			'Helicone-Property-User-Id': userId, // Track user
			'Helicone-Property-Environment': 'production', // Track environment
		},
	}
);
```

Now you can filter and analyze by agent, user, or environment in the dashboard!

---

## Real-World Example: Cost Tracking

**Scenario:** Your RAG system has two agents:

-   LinkedIn agent (fine-tuned model, expensive)
-   Knowledge Base agent (gpt-4o-mini, cheap)

**Without Helicone:**

-   Total OpenAI bill: $250/month
-   No idea which agent costs what
-   Can't optimize spend

**With Helicone:**

```
LinkedIn agent:     $200/month (80% of cost)
  - 10,000 requests
  - Avg: $0.02/request

Knowledge Base:     $50/month (20% of cost)
  - 50,000 requests
  - Avg: $0.001/request
```

**Action:** You discover LinkedIn agent is too expensive. Options:

1. Cache common requests
2. Switch to cheaper base model
3. Add rate limiting
4. Optimize prompts to use fewer tokens

---

## Your Challenge

### Task 1: Integrate Helicone

1. Sign up for Helicone account
2. Get API key
3. Update `app/libs/openai/openai.ts` with proxy configuration
4. Verify it works by running your app

### Task 2: Generate Some Traffic

Make a few requests to your RAG system:

```bash
yarn dev
# Open http://localhost:3000
# Ask some questions
```

### Task 3: Explore Dashboard

Visit Helicone dashboard and find:

-   Total requests made
-   Cost per request
-   Average latency
-   Request/response logs

### Task 4: Add Custom Properties (Optional)

Update your agent implementations to include custom properties:

-   Agent name
-   User identifier
-   Query type

---

## Common Issues

**❌ "Unauthorized" error**
→ Check your `HELICONE_API_KEY` in `.env`

**❌ "Connection refused"**
→ Verify `baseURL` is exactly `https://oai.helicone.ai/v1`

**❌ "No data in dashboard"**
→ Make sure you're making requests through the instrumented client

**❌ "Slow responses"**
→ Helicone adds ~10-20ms; if it's more, check your network

---

## When to Use Helicone

**✅ Always use in production**

-   Essential for debugging
-   Critical for cost management
-   Required for optimization

**✅ Use in development/staging**

-   Catch issues before production
-   Understand usage patterns early
-   Test rate limiting and caching

**❌ Maybe skip in local dev**

-   Extra hop adds latency
-   Less important for rapid iteration
-   Can enable when needed

---

## Alternatives to Helicone

Other observability tools for LLMs:

**LangSmith** (by LangChain)

-   Deep LangChain integration
-   More complex setup
-   Good for LangChain users

**Weights & Biases**

-   ML experiment tracking
-   Heavier weight
-   Good for research/experimentation

**Custom Logging**

-   Full control
-   More work to build
-   Good for specific needs

**Why we chose Helicone:**

-   Simplest integration (2 lines)
-   OpenAI-specific features
-   Great free tier
-   Open source option

---

## What's Next?

You now have full observability into your RAG system!

In the next section, we'll test our selector agent to ensure it routes queries correctly to the right agents.
