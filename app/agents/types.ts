import { z } from 'zod';
import { StreamTextResult } from 'ai';

export const agentTypeSchema = z.enum(['linkedin', 'rag']);

export type AgentType = z.infer<typeof agentTypeSchema>;

export const messageSchema = z.object({
	role: z.enum(['user', 'assistant', 'system']),
	content: z.string(),
});

export type Message = z.infer<typeof messageSchema>;

export interface AgentRequest {
	type: AgentType;
	query: string; // Refined/summarized query from selector
	originalQuery: string; // Original user message
	messages: Message[]; // Full conversation history
}

export type AgentResponse = StreamTextResult<Record<string, never>>;

export interface AgentConfig {
	name: string;
	description: string;
}
