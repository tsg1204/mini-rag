import { AgentType, AgentConfig } from './types';

export const agentConfigs: Record<AgentType, AgentConfig> = {
	linkedin: {
		name: 'LinkedIn Agent',
		description:
			'For polishing a written post for LinkedIn, you will be given a query and you will need to write a post for LinkedIn based on the query.',
	},
	rag: {
		name: 'RAG Agent',
		description:
			'For generating a LinkedIn post content based on user query, you will be given a query and you will need to generate content based on the query.',
	},
};
