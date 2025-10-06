# Similarity Calculations: The Heart of RAG

Understanding how to measure similarity between vectors is crucial for RAG systems. Let's explore the core concepts with simple explanations.

Clone this repo to follow along: https://github.com/projectshft/mini-rag

## Why Vector Similarity Matters

In RAG systems, we need to find documents that are most similar to a user's question. Since both are represented as vectors, we need mathematical ways to measure "closeness."

```typescript
// The core RAG question:
// Given a query vector Q and document vectors [D1, D2, D3...]
// Which documents are most similar to Q?

const queryVector = [0.2, 0.8, 0.1, 0.4];
const documentVectors = [
  [0.3, 0.7, 0.2, 0.5],  // Document 1
  [0.1, 0.9, 0.1, 0.3],  // Document 2  
  [0.8, 0.2, 0.4, 0.1]   // Document 3
];

// Which document is most similar to the query?
```

## Three Ways to Measure Vector Similarity

### 1. Dot Product: The Basic Similarity Measure

The dot product is the simplest way to measure how similar two vectors are.

**What it is:**
- Multiply corresponding elements, then add them up
- Higher values generally mean more similarity

**Formula:**
```
dot_product(A, B) = A[0]*B[0] + A[1]*B[1] + ... + A[n]*B[n]
```

**Simple Example:**
```javascript
// Two 3D vectors
const vector1 = [1, 2, 3];
const vector2 = [4, 5, 6];

// Dot product calculation
const dotProduct = (1*4) + (2*5) + (3*6) = 4 + 10 + 18 = 32
```

**Limitation:**
The dot product is affected by vector length. Longer vectors can have larger dot products even if they're not more similar in direction.

### 2. Euclidean Distance: The Straight-Line Distance

Euclidean distance measures how far apart two vectors are in space.

**What it is:**
- The straight-line distance between two points in space
- Lower values mean more similarity (0 = identical)

**Formula:**
```
euclidean_distance(A, B) = sqrt((A[0]-B[0])² + (A[1]-B[1])² + ... + (A[n]-B[n])²)
```

**Simple Example:**
```javascript
// Two 2D vectors
const point1 = [1, 2];
const point2 = [4, 6];

// Euclidean distance calculation
const distance = sqrt((1-4)² + (2-6)²) = sqrt(9 + 16) = sqrt(25) = 5
```

**Limitation:**
Euclidean distance is sensitive to the magnitude of vectors, which can be problematic for text embeddings where we care more about direction than magnitude.

### 3. Cosine Similarity: The Direction Comparison

Cosine similarity measures the angle between two vectors, ignoring their magnitude.

**What it is:**
- Measures the cosine of the angle between vectors
- Values range from -1 (opposite) to 1 (identical)
- 0 means vectors are perpendicular (unrelated)

**Formula:**
```
cosine_similarity(A, B) = dot_product(A, B) / (magnitude(A) * magnitude(B))

Where:
magnitude(V) = sqrt(V[0]² + V[1]² + ... + V[n]²)
```

**Visual Understanding:**
```
     A •
        \
         \  θ (angle)
          \
           • B

cosine(θ) = similarity score
- θ = 0°   → cos(0°) = 1   (identical direction)
- θ = 90°  → cos(90°) = 0  (perpendicular) 
- θ = 180° → cos(180°) = -1 (opposite direction)
```

## Implementing Cosine Similarity

Here's a simple implementation of cosine similarity:

```typescript
// Calculate dot product
function dotProduct(vectorA, vectorB) {
  return vectorA.reduce((sum, a, i) => sum + (a * vectorB[i]), 0);
}

// Calculate magnitude (length) of a vector
function magnitude(vector) {
  const sumOfSquares = vector.reduce((sum, val) => sum + (val * val), 0);
  return Math.sqrt(sumOfSquares);
}

// Calculate cosine similarity
function cosineSimilarity(vectorA, vectorB) {
  const dotProd = dotProduct(vectorA, vectorB);
  const magnitudeA = magnitude(vectorA);
  const magnitudeB = magnitude(vectorB);
  
  // Avoid division by zero
  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }
  
  return dotProd / (magnitudeA * magnitudeB);
}

// Example
const vector1 = [1, 2, 3];
const vector2 = [4, 5, 6];
const similarity = cosineSimilarity(vector1, vector2);
console.log(`Similarity: ${similarity}`); // ~0.974 (very similar!)
```

## Visual Example with 2D Vectors

Let's visualize how these similarity measures work with simple 2D vectors:

```
A = [3, 4]
B = [5, 0]
C = [1.5, 2]  // This is A scaled down by 0.5
```

**Dot Product:**
```
dot(A, B) = (3 × 5) + (4 × 0) = 15
dot(A, C) = (3 × 1.5) + (4 × 2) = 12.5
```

**Euclidean Distance:**
```
distance(A, B) = √[(3-5)² + (4-0)²] = √20 ≈ 4.47
distance(A, C) = √[(3-1.5)² + (4-2)²] = √6.25 = 2.5
```

**Cosine Similarity:**
```
|A| = √(3² + 4²) = 5
|B| = √(5² + 0²) = 5
|C| = √(1.5² + 2²) = 2.5

cosine(A, B) = 15/(5×5) = 0.6
cosine(A, C) = 12.5/(5×2.5) = 1.0
```

A and C have a cosine similarity of 1.0 (perfect similarity) because they point in exactly the same direction, even though their lengths differ.

## When to Use Each Similarity Measure

### Cosine Similarity ✅
- **Best for**: Text embeddings, semantic search
- **Why**: Focuses on direction, not magnitude
- **Use cases**: RAG systems, document similarity, semantic search

### Euclidean Distance 📏
- **Best for**: Spatial data, image embeddings
- **Why**: Considers actual distance in space
- **Use cases**: Image similarity, clustering

### Dot Product
- **Best for**: When vector magnitude matters
- **Why**: Simple calculation that considers both direction and magnitude
- **Use cases**: Some recommendation systems, weighted similarity

## Practical Application: Word Embeddings

When words are converted to vectors (embeddings), these similarity measures help us understand relationships between words:

1. **Words with similar meanings** have vectors pointing in similar directions
2. **Unrelated words** have vectors pointing in different directions
3. **Opposite concepts** may have vectors pointing in opposite directions

This is why we can do operations like:
```
king - man + woman ≈ queen
```

This works because:
- The vector for "king" contains concepts of "royalty" and "male"
- Subtracting "man" removes the "male" component
- Adding "woman" adds the "female" component
- The result points to "queen" in the vector space

## Testing Your Understanding

Try these examples to verify your understanding:

```typescript
// Test cases
function testSimilarityFunctions() {
  // Test 1: Identical vectors should have similarity of 1
  const identical1 = [1, 0, 0];
  const identical2 = [1, 0, 0];
  console.log('Identical vectors:', cosineSimilarity(identical1, identical2)); // Should be 1
  
  // Test 2: Perpendicular vectors should have similarity of 0
  const perpendicular1 = [1, 0];
  const perpendicular2 = [0, 1];
  console.log('Perpendicular vectors:', cosineSimilarity(perpendicular1, perpendicular2)); // Should be 0
  
  // Test 3: Opposite vectors should have similarity of -1
  const opposite1 = [1, 0];
  const opposite2 = [-1, 0];
  console.log('Opposite vectors:', cosineSimilarity(opposite1, opposite2)); // Should be -1
}
```

The math might seem complex, but remember: you're just measuring how "similar" two lists of numbers are. Everything else builds on this foundation!