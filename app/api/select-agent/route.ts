import { NextRequest, NextResponse } from 'next/server';
import { openaiClient } from '@/app/libs/openai/openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { agentTypeSchema, messageSchema } from '@/app/agents/types';
import { agentConfigs } from '@/app/agents/config';

const selectAgentSchema = z.object({
	messages: z.array(messageSchema).min(1),
});

const agentSelectionSchema = z.object({
	agent: agentTypeSchema,
	query: z.string(),
});

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const parsed = selectAgentSchema.parse(body);
		const { messages } = parsed;

		// Take last 5 messages for context
		const recentMessages = messages.slice(-5);

		// Build agent descriptions from config
		const agentDescriptions = Object.entries(agentConfigs)
			.map(([key, config]) => `- "${key}": ${config.description}`)
			.join('\n');

		// Summarize conversation and determine agent
		const completion = await openaiClient.chat.completions.create({
			model: 'gpt-4o-mini',
			messages: [
				{
					role: 'system',
					content: `You are an agent router. Based on the conversation history, determine which agent should handle the request and create a focused query.

Available agents:
${agentDescriptions}

The query should be a refined, clear version of what the user wants, removing conversational fluff.`,
				},
				...recentMessages.map((msg) => ({
					role: msg.role,
					content: msg.content,
				})),
			],
			response_format: zodResponseFormat(
				agentSelectionSchema,
				'agentSelection'
			),
		});

		const content = completion.choices[0]?.message?.content;
		if (!content) {
			throw new Error('No response from OpenAI');
		}

		const result = agentSelectionSchema.parse(JSON.parse(content));

		return NextResponse.json({
			agent: result.agent,
			query: result.query,
		});
	} catch (error) {
		console.error('Error selecting agent:', error);
		return NextResponse.json(
			{ error: 'Failed to select agent' },
			{ status: 500 }
		);
	}
}
