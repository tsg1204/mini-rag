import { selectAgent } from '../selector-agent';
import { AGENT_CONFIG } from '../types';

describe('selectAgent', () => {
	// TODO: add some test for queries which should NOT be supported
	const testCases = [
		{
			name: 'should select LinkedIn agent for LinkedIn-related queries',
			query: 'Write a LinkedIn post about learning JavaScript',
			expectedAgent: 'linkedin',
			expectedModel: AGENT_CONFIG.linkedin.model,
		},
		{
			name: 'should select Knowledge Base agent for coding queries',
			query: 'Why are enums in TypeScript useful?',
			expectedAgent: 'knowledgeBase',
			expectedModel: AGENT_CONFIG.knowledgeBase.model,
		},
	];

	testCases.forEach(({ name, query, expectedAgent, expectedModel }) => {
		it(name, async () => {
			const result = await selectAgent(query);
			expect(result.selectedAgent).toBe(expectedAgent);
			expect(result.model).toBe(expectedModel);
		});
	});
});
