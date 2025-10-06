import * as fs from 'fs';
import { SimpleChunker } from './simple-chunking-solution';

/**
 * Demonstration script showing the chunking solution in action
 */
async function runDemo() {
  console.log('🧪 RAG Chunking Challenge Demo\n');

  const chunker = new SimpleChunker();

  // Load the test document
  let reactDocs: string;
  try {
    reactDocs = fs.readFileSync('./sample-react-docs.md', 'utf8');
    console.log(`📄 Loaded React docs: ${reactDocs.length} characters`);
  } catch (error) {
    reactDocs = "React is a JavaScript library for building user interfaces.".repeat(50);
    console.log('📄 Using fallback content for demo');
  }

  // Test with different documents to show ID uniqueness
  const vue3Docs = `
    # Vue 3 Documentation

    Vue 3 is the latest major version of Vue.js, a progressive JavaScript framework for building user interfaces.
    Vue 3 introduces the Composition API, which provides better logic reuse and more flexible code organization.
    The Composition API is an addition to Vue 3 that provides an alternative to the Options API.

    ## Reactivity System

    Vue 3 features a completely rewritten reactivity system built on ES6 Proxies. This new system provides better
    performance and more comprehensive reactivity coverage. The new reactivity system can track property access,
    assignment, and enumeration operations.

    ## Performance Improvements

    Vue 3 offers significant performance improvements over Vue 2. The new virtual DOM implementation is faster,
    the bundle size is smaller, and tree-shaking support is better. Memory usage is also reduced significantly.
  `.repeat(10);

  console.log('\n🔨 Chunking React documentation...');
  const reactChunks = chunker.chunkText(reactDocs, 'react-docs.md', { maxTokens: 512 });

  console.log('\n🔨 Chunking Vue 3 documentation...');
  const vueChunks = chunker.chunkText(vue3Docs, 'vue3-docs.md', { maxTokens: 512 });

  // Validate both sets of chunks
  console.log('\n✅ Validating React chunks...');
  const reactValidation = chunker.validateChunks(reactChunks, 512);

  console.log('\n✅ Validating Vue chunks...');
  const vueValidation = chunker.validateChunks(vueChunks, 512);

  // Test uniform ID generation
  console.log('\n🆔 Testing uniform ID generation...');
  const idTestPassed = chunker.testUniformIds();

  // Display results
  console.log('\n📊 RESULTS SUMMARY');
  console.log('===================');

  console.log(`\n📄 React Documentation:`);
  console.log(`   • Chunks created: ${reactChunks.length}`);
  console.log(`   • Validation passed: ${reactValidation.isValid ? '✅' : '❌'}`);
  console.log(`   • Issues found: ${reactValidation.issues.length}`);

  console.log(`\n📄 Vue 3 Documentation:`);
  console.log(`   • Chunks created: ${vueChunks.length}`);
  console.log(`   • Validation passed: ${vueValidation.isValid ? '✅' : '❌'}`);
  console.log(`   • Issues found: ${vueValidation.issues.length}`);

  console.log(`\n🆔 ID Generation Test: ${idTestPassed ? '✅ PASSED' : '❌ FAILED'}`);

  // Show document ID differences
  const reactDocId = reactChunks[0]?.metadata.documentId;
  const vueDocId = vueChunks[0]?.metadata.documentId;
  console.log(`   • React doc ID: ${reactDocId}`);
  console.log(`   • Vue doc ID: ${vueDocId}`);
  console.log(`   • IDs are different: ${reactDocId !== vueDocId ? '✅' : '❌'}`);

  // Display sample chunks
  console.log('\n📋 SAMPLE CHUNKS');
  console.log('==================');

  const sampleReactChunk = reactChunks[0];
  const sampleVueChunk = vueChunks[0];

  if (sampleReactChunk) {
    console.log(`\n📄 React Chunk Example:`);
    console.log(`   ID: ${sampleReactChunk.id}`);
    console.log(`   Tokens: ${sampleReactChunk.metadata.tokenCount}/512`);
    console.log(`   Last stored: ${sampleReactChunk.metadata.lastStored.toISOString()}`);
    console.log(`   Content preview: ${sampleReactChunk.content.substring(0, 150)}...`);

    // Check word boundary
    const endsCleanly = !/[a-zA-Z]$/.test(sampleReactChunk.content) ||
                       sampleReactChunk.content.endsWith('.');
    console.log(`   Ends with complete word: ${endsCleanly ? '✅' : '❌'}`);
  }

  if (sampleVueChunk) {
    console.log(`\n📄 Vue Chunk Example:`);
    console.log(`   ID: ${sampleVueChunk.id}`);
    console.log(`   Tokens: ${sampleVueChunk.metadata.tokenCount}/512`);
    console.log(`   Last stored: ${sampleVueChunk.metadata.lastStored.toISOString()}`);
    console.log(`   Content preview: ${sampleVueChunk.content.substring(0, 150)}...`);

    // Check word boundary
    const endsCleanly = !/[a-zA-Z]$/.test(sampleVueChunk.content) ||
                       sampleVueChunk.content.endsWith('.');
    console.log(`   Ends with complete word: ${endsCleanly ? '✅' : '❌'}`);
  }

  // Test constraints summary
  console.log('\n🎯 CONSTRAINT VERIFICATION');
  console.log('============================');

  let allTestsPassed = true;

  // Test 1: Token limits
  const allChunksWithinLimit = [...reactChunks, ...vueChunks].every(
    chunk => chunk.metadata.tokenCount <= 512
  );
  console.log(`✓ All chunks within 512 token limit: ${allChunksWithinLimit ? '✅' : '❌'}`);
  if (!allChunksWithinLimit) allTestsPassed = false;

  // Test 2: Complete words
  const allChunksCompleteWords = [...reactChunks, ...vueChunks].every(chunk => {
    if (chunk.content.length === 0) return true;
    const lastChar = chunk.content.charAt(chunk.content.length - 1);
    return !/[a-zA-Z]/.test(lastChar) || /[\s.!?]/.test(chunk.content.charAt(chunk.content.length - 2));
  });
  console.log(`✓ All chunks end with complete words: ${allChunksCompleteWords ? '✅' : '❌'}`);
  if (!allChunksCompleteWords) allTestsPassed = false;

  // Test 3: Date tracking
  const now = new Date();
  const fiveSecondsAgo = new Date(now.getTime() - 5000);
  const allChunksHaveRecentDates = [...reactChunks, ...vueChunks].every(
    chunk => chunk.metadata.lastStored >= fiveSecondsAgo && chunk.metadata.lastStored <= now
  );
  console.log(`✓ All chunks have recent lastStored dates: ${allChunksHaveRecentDates ? '✅' : '❌'}`);
  if (!allChunksHaveRecentDates) allTestsPassed = false;

  // Test 4: Uniform IDs
  console.log(`✓ Different documents have different IDs: ${idTestPassed ? '✅' : '❌'}`);
  if (!idTestPassed) allTestsPassed = false;

  console.log(`\n🏆 OVERALL RESULT: ${allTestsPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);

  // Show any validation issues
  if (reactValidation.issues.length > 0) {
    console.log('\n⚠️  React Validation Issues:');
    reactValidation.issues.forEach(issue => console.log(`   • ${issue}`));
  }

  if (vueValidation.issues.length > 0) {
    console.log('\n⚠️  Vue Validation Issues:');
    vueValidation.issues.forEach(issue => console.log(`   • ${issue}`));
  }

  console.log('\n🎉 Demo complete! Run "npm test" to run the full test suite.\n');
}

// Run the demo if this file is executed directly
if (require.main === module) {
  runDemo().catch(console.error);
}

export { runDemo };