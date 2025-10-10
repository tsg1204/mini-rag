# AI-Powered Content Generation and RAG

A full-stack TypeScript application demonstrating modern AI techniques including RAG (Retrieval Augmented Generation), fine-tuning, agents, and LLM observability with automated web scraping capabilities.

## Prerequisites

Before getting started, you'll need to set up the following services:

### Required API Keys

1. **OpenAI API Key** (https://platform.openai.com/api-keys)
   - You'll need at least $5 in credits on your OpenAI account
   - Used for embeddings, chat completions, and fine-tuning

2. **Pinecone API Key** (https://www.pinecone.io/)
   - Free tier available
   - Used for vector database storage and similarity search

3. **Helicone API Key** (https://www.helicone.ai/)
   - Free tier available
   - Used for LLM observability and monitoring

Create a `.env` file in the root directory with these keys:

```
OPENAI_API_KEY=your_openai_key_here
PINECONE_API_KEY=your_pinecone_key_here
HELICONE_API_KEY=your_helicone_key_here
PINECONE_INDEX=your_index_name
OPENAI_FINETUNED_MODEL=your_finetuned_model_id (optional)
```

### Recommended Learning Resources

Before diving into the code, we highly recommend watching 3Blue1Brown's series on neural networks and embeddings to build intuition for how these systems work:

- [Neural Networks Series](https://www.youtube.com/playlist?list=PLZHQObOWTQDNU6R1_67000Dx_ZCJB-3pi) - Visual introduction to neural networks
- [But what is a GPT?](https://www.youtube.com/watch?v=wjZofJX0v4M) - Understanding transformer architecture
- [Visualizing Attention](https://www.youtube.com/watch?v=eMlx5fFNoYc) - How attention mechanisms work

## Features

-   **Multi-Agent System**: 2 specialized agents for different content types:

    -   LinkedIn Agent: Uses a fine-tuned GPT-4 model for professional content to post on LinkedIn
    -   RAG Agent: Leverages Pinecone vector database for RAG-based content analysis

-   **Web Scraping**:

    -   Extraction of articles from multiple sources
    -   Bias detection and content structuring
    -   Direct vectorization and storage in Pinecone database

-   **Training Pipeline**:

    -   Scripts for fine-tuning data preparation
    -   Cost estimation tools
    -   Training job management

-   **Observability**:
    -   Integration with Helicone for LLM monitoring
    -   Performance tracking
    -   Usage analytics

## Tech Stack

-   **Frontend**: Next.js, TypeScript, TailwindCSS
-   **Backend**: Next.js API Routes
-   **AI/ML**: OpenAI API, Pinecone Vector Database
-   **Web Scraping**: Puppeteer
-   **Monitoring**: Helicone
-   **Package Manager**: Yarn

## Learning Objectives

This repository serves as a practical guide for you to learn:

1. **RAG Implementation**

    - Vector database integration with Pinecone
    - Semantic search capabilities
    - Automated web scraping
    - Context-aware responses using retrieved content

2. **Fine-tuning**

    - Data preparation
    - Model training
    - Cost optimization

3. **Agent Architecture**

    - Specialized agent design
    - Response handling
    - Agent response format

4. **Web Scraping & Data Pipeline**

    - Intelligent content extraction
    - Automated bias detection
    - Content vectorization and storage

5. **LLM Observability**

    - Performance monitoring
    - Usage tracking
    - Cost management

6. **News Article Scraping & Vectorization**

    - The application uses Puppeteer to automatically scrape news articles from configured sources
    - Articles are processed to extract content
    - Scraped content is automatically vectorized using OpenAI embeddings and stored in Pinecone

7. **Manual Article Upload**
    - Navigate to `/scrape-content` to manually scrape urls
    - Content is automatically vectorized and added to the Pinecone database

## Project Structure

```
mini-rag/
├── app/
│   ├── api/              # API routes
│   ├── libs/             # Shared utilities
│   ├── scripts/          # Training and data scripts
│   └── page.tsx          # Main application
```

## Resources

-   [OpenAI Documentation](https://platform.openai.com/docs)
-   [Pinecone Documentation](https://docs.pinecone.io)
-   [Helicone Documentation](https://docs.helicone.ai)
-   [Next.js Documentation](https://nextjs.org/docs)
