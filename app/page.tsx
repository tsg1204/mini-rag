'use client';

import { useChat } from '@ai-sdk/react';
import { useState } from 'react';

export default function Home() {
	const { messages, input, handleInputChange, handleSubmit, isLoading } =
		useChat({
			api: '/api/chat',
		});

	const [uploadUrls, setUploadUrls] = useState('');
	const [isUploading, setIsUploading] = useState(false);
	const [uploadStatus, setUploadStatus] = useState('');

	const handleUpload = async () => {
		if (!uploadUrls.trim()) return;

		setIsUploading(true);
		setUploadStatus('');

		try {
			const urls = uploadUrls
				.split('\n')
				.map((url) => url.trim())
				.filter(Boolean);

			const response = await fetch('/api/upload-document', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ urls }),
			});

			const data = await response.json();

			if (response.ok) {
				setUploadStatus(
					`✅ Success! Uploaded ${data.vectorsUploaded} vectors`
				);
				setUploadUrls('');
			} else {
				setUploadStatus(`❌ Error: ${data.error}`);
			}
		} catch {
			setUploadStatus('❌ Failed to upload documents');
		} finally {
			setIsUploading(false);
		}
	};

	const handleChatSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		if (!input.trim() || isLoading) return;

		// Build messages array including current input
		const currentMessages = [
			...messages,
			{ role: 'user' as const, content: input },
		];

		// Step 1: Select agent and get summarized query
		const agentResponse = await fetch('/api/select-agent', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ messages: currentMessages }),
		});

		const { agent, query } = await agentResponse.json();

		// Step 2: Submit to chat with agent and query
		handleSubmit(e, {
			body: {
				agent,
				query,
			},
		});
	};

	return (
		<div className='min-h-screen p-8 max-w-4xl mx-auto'>
			<h1 className='text-3xl font-bold mb-8'>Mini RAG Chat</h1>

			{/* Upload Section */}
			<div className='mb-8 p-4 border rounded'>
				<h2 className='text-xl font-semibold mb-4'>
					Upload Documents
				</h2>
				<textarea
					value={uploadUrls}
					onChange={(e) => setUploadUrls(e.target.value)}
					placeholder='Enter URLs (one per line)'
					className='w-full p-2 border rounded mb-2 h-24'
					disabled={isUploading}
				/>
				<button
					onClick={handleUpload}
					disabled={isUploading || !uploadUrls.trim()}
					className='px-4 py-2 bg-blue-600 text-white rounded disabled:bg-gray-400'
				>
					{isUploading ? 'Uploading...' : 'Upload'}
				</button>
				{uploadStatus && (
					<p className='mt-2 text-sm'>{uploadStatus}</p>
				)}
			</div>

			{/* Chat Section */}
			<div className='border rounded p-4'>
				<h2 className='text-xl font-semibold mb-4'>Chat</h2>

				<div className='h-96 overflow-y-auto mb-4 space-y-4'>
					{messages.length === 0 && (
						<p className='text-gray-500'>
							Start a conversation...
						</p>
					)}
					{messages.map((message) => (
						<div
							key={message.id}
							className={`p-3 rounded ${
								message.role === 'user'
									? 'bg-blue-100 ml-8'
									: 'bg-gray-100 mr-8'
							}`}
						>
							<p className='font-semibold mb-1'>
								{message.role === 'user' ? 'You' : 'AI'}
							</p>
							<div className='whitespace-pre-wrap'>
								{message.parts
									.map((part: string | { text?: string }) =>
										typeof part === 'string'
											? part
											: part.text || ''
									)
									.join('')}
							</div>
						</div>
					))}
					{isLoading && (
						<div className='p-3 rounded bg-gray-100 mr-8'>
							<p className='text-gray-500'>Thinking...</p>
						</div>
					)}
				</div>

				<form onSubmit={handleChatSubmit} className='flex gap-2'>
					<input
						value={input}
						onChange={handleInputChange}
						placeholder='Ask a question...'
						className='flex-1 p-2 border rounded'
						disabled={isLoading}
					/>
					<button
						type='submit'
						disabled={isLoading || !input.trim()}
						className='px-6 py-2 bg-green-600 text-white rounded disabled:bg-gray-400'
					>
						Send
					</button>
				</form>
			</div>
		</div>
	);
}
