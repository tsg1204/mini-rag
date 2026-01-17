import * as cheerio from 'cheerio';

export type Chunk = {
	id: string;
	content: string;
	metadata: {
		source: string;
		chunkIndex: number;
		totalChunks: number;
		startChar: number;
		endChar: number;
		[key: string]: string | number | boolean | string[];
	};
};

/**
 * Splits text into smaller chunks for processing
 * @param text The text to chunk
 * @param chunkSize Maximum size of each chunk
 * @param overlap Number of characters to overlap between chunks
 * @param source Source identifier (typically URL)
 * @returns Array of text chunks
 */
export function chunkText(
	text: string,
	chunkSize: number = 500,
	overlap: number = 50,
	source: string = 'unknown'
): Chunk[] {
	const chunks: Chunk[] = [];
	const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);

	let currentChunk = '';
	let chunkStart = 0;
	let chunkIndex = 0;

	for (let i = 0; i < sentences.length; i++) {
		const sentence = sentences[i].trim() + '.';

		// If adding this sentence would exceed chunk size, create a chunk
		if (
			currentChunk.length + sentence.length > chunkSize &&
			currentChunk.length > 0
		) {
			const chunk: Chunk = {
				id: `${source}-chunk-${chunkIndex}`,
				content: currentChunk.trim(),
				metadata: {
					source,
					chunkIndex,
					totalChunks: 0, // Will be updated later
					startChar: chunkStart,
					endChar: chunkStart + currentChunk.length,
				},
			};

			chunks.push(chunk);

			// Start new chunk with overlap
			const overlapText = getLastWords(currentChunk, overlap);
			currentChunk = overlapText + ' ' + sentence;
			chunkStart = chunk.metadata.endChar - overlapText.length;
			chunkIndex++;
		} else {
			currentChunk += (currentChunk ? ' ' : '') + sentence;
		}
	}

	// Add final chunk if it has content
	if (currentChunk.trim()) {
		chunks.push({
			id: `${source}-chunk-${chunkIndex}`,
			content: currentChunk.trim(),
			metadata: {
				source,
				chunkIndex,
				totalChunks: 0,
				startChar: chunkStart,
				endChar: chunkStart + currentChunk.length,
			},
		});
	}

	// Update total chunks count
	chunks.forEach((chunk) => {
		chunk.metadata.totalChunks = chunks.length;
	});

	return chunks;
}

/**
 * Gets the last N characters worth of words from a text
 *
 * This is used to create overlap between chunks. We want complete words,
 * not cut-off characters, so we work backwards from the end.
 *
 * @param text The source text
 * @param maxLength Maximum length to return
 * @returns The last words up to maxLength
 *
 * @example
 * getLastWords("React Hooks are awesome", 10)
 * // Returns: "are awesome" (10 chars)
 * // NOT: "re awesome" (cut off "are")
 *

 *
 * Requirements:
 * 1. If text is shorter than maxLength, return the whole text
 * 2. Otherwise, return the last maxLength characters worth of COMPLETE words
 * 3. Build the result backwards to ensure you get the last words
 *
 * Steps:
 * 1. Check if text.length <= maxLength, if so return text
 * 2. Split text into words using .split(' ')
 * 3. Start with empty result string
 * 4. Loop through words BACKWARDS (from end to start)
 * 5. For each word, check if adding it would exceed maxLength
 * 6. If it would exceed, break the loop
 * 7. Otherwise, prepend the word to result (word + ' ' + result)
 * 8. Return the result
 */
function getLastWords(text: string, maxLength: number): string {
	// TODO: Implement this function!
	// YOUR CODE HERE
		//If text is already short, return it
		if (text.length <= maxLength) {
			return text;
		}
		//Split text into words
		const words = text.split(' ');
	
		let result = '';
	
		//Loop backwards through the words
		for (let i = words.length - 1; i >= 0; i--) {
			const word = words[i];
			//new result
			const candidate = result === '' ? word : `${word} ${result}`;
	
			//Check if adding this word would exceed maxLength
			if (candidate.length > maxLength) {
				break;
			}
			result = candidate;
		}
		return result;
}

export type MediumArticle = {
	text: string;
	url: string;
	author: string;
	title: string;
	date: string;
	source: string;
	language: string;
}

/**
 * Extracts article data from a Medium HTML export
 * @param html The HTML content of a Medium article export
 * @returns A MediumArticle object with extracted data
 */
export function extraMediumArticle(html: string): MediumArticle {
	const $ = cheerio.load(html);

	// Extract title from h1.p-name
	const title = $('h1.p-name').text().trim() || '';

	// Extract author from footer a.p-author
	const author = $('footer a.p-author.h-card').text().trim() || '';

	// Extract date from footer time.dt-published
	const dateTime = $('footer time.dt-published').attr('datetime') || '';
	const dateText = $('footer time.dt-published').text().trim() || dateTime;
	const date = dateText;

	// Extract URL from footer a.p-canonical
	const url = $('footer a.p-canonical').attr('href') || '';

	// Extract text content from section[data-field="body"]
	const bodySection = $('section[data-field="body"].e-content');
	const paragraphs: string[] = [];
	
	bodySection.find('p').each((_index: number, elem) => {
		const text = $(elem).text().trim();
		if (text) {
			paragraphs.push(text);
		}
	});

	const text = paragraphs.join(' ').trim();

	// Extract language from html lang attribute or default to 'en'
	const language = $('html').attr('lang') || 'en';

	return {
		text,
		url,
		author,
		title,
		date,
		source: 'medium',
		language,
	};
}


