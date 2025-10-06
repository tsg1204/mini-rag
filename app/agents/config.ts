import { AgentType, AgentConfig } from './types';

export const agentConfigs: Record<AgentType, AgentConfig> = {
	linkedin: {
		name: 'LinkedIn Agent',
		description:
			'For questions about LinkedIn, professional networking, career advice, or professional content',
	},
	rag: {
		name: 'RAG Agent',
		description:
			'For questions about documentation, technical content, or information that requires knowledge base retrieval',
	},
};
