import { AgentRequest, AgentResponse } from './types';
import { openai } from '@ai-sdk/openai';
import { streamText } from 'ai';

export async function linkedInAgent(
	request: AgentRequest
): Promise<AgentResponse> {
	const fineTunedModel = process.env.OPENAI_FINETUNED_MODEL;

	if (!fineTunedModel) {
		throw new Error('OPENAI_FINETUNED_MODEL not configured');
	}

	const systemPrompt = `You are a professional assistant helping with LinkedIn and career-related questions.

Original User Request: "${request.originalQuery}"

Refined Query: "${request.query}"

Use the refined query to understand what the user is asking for, and provide a helpful response based on the conversation history.`;

	return streamText({
		model: openai(fineTunedModel),
		system: systemPrompt,
		messages: request.messages,
	});
}
